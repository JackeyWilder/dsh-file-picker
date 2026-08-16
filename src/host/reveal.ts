// src/host/reveal.ts
import { spawn } from 'node:child_process'

/**
 * Reveal a file in Windows Explorer (folder opened with the file selected)
 * AND bring the window to the foreground.
 *
 * 2026-08-17, implementations benchmarked live (same path, foreground probed
 * via GetForegroundWindow):
 * 1. `spawn('explorer', ['/select,"<path>"'])` — Node's libuv quotes the
 *    space-containing arg and escapes the inner `"` to `\"`; explorer cannot
 *    parse it, starts windowless, and lingers forever. BROKEN.
 * 2. Same argv with `shell: true` (cmd.exe forwards the quoted segment
 *    verbatim) — window appears, but the Windows foreground lock keeps it
 *    behind the active window. HALF-WORKING.
 * 3. pwsh `Start-Process explorer.exe` (ShellExecute path, window created by
 *    the desktop shell host) plus a foreground unlock: poll until the window
 *    whose title contains the file name appears, ShowWindow(SW_RESTORE), then
 *    inject a bare ALT keystroke (grants the caller foreground-activation
 *    rights) and SetForegroundWindow. Verified: foreground becomes explorer.
 *    THIS ONE.
 *
 * The pwsh script carries the path in single-quoted strings (only `'` needs
 * doubling); inside them `%`, `&`, `|` etc. have no meaning, so the cmd-escape
 * concerns from the shell:true variant do not apply. The polling loop has a
 * hard 10s deadline, so the child always exits on its own — no stuck guard.
 */
export function revealPath(path: string): void {
  // Explorer's window title is the PARENT directory plus " - 文件资源管理器"
  // — it never contains the file name, so match on the directory instead.
  const parent = path.slice(0, Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')))
  const script = [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    'Add-Type @\'',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public static class FpReveal {',
    '  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);',
    '  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);',
    '  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);',
    '}',
    '\'@',
    `$p = '${path.replace(/'/g, "''")}'`,
    `$dir = '${parent.replace(/'/g, "''")}'`,
    "$arg = '/select,\"' + $p + '\"'",
    'Start-Process -FilePath explorer.exe -ArgumentList $arg',
    '$deadline = (Get-Date).AddSeconds(10)',
    '$win = $null',
    'while ((Get-Date) -lt $deadline -and $null -eq $win) {',
    '  Start-Sleep -Milliseconds 250',
    '  $win = Get-Process explorer -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.Contains($dir) } | Select-Object -First 1',
    '}',
    'if ($null -ne $win) {',
    '  [FpReveal]::ShowWindow($win.MainWindowHandle, 9) | Out-Null',
    '  [FpReveal]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)',
    '  [FpReveal]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)',
    '  [FpReveal]::SetForegroundWindow($win.MainWindowHandle) | Out-Null',
    '}',
  ].join('\n')
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  // Same pwsh invocation contract as the native picker: -EncodedCommand keeps
  // the script out of the ANSI-codepage mangling of a raw -Command line.
  const child = spawn('pwsh', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    windowsHide: true,
    stdio: 'ignore',
  })
  // spawn() reports ENOENT etc. asynchronously via 'error'; without a
  // listener an unhandled 'error' would crash the host process.
  child.on('error', () => {})
  child.unref()
}