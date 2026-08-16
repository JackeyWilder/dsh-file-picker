import { spawn } from 'node:child_process'

export interface NativePickResult {
  paths: string[]
  canceled: boolean
}

/**
 * Build the pwsh script that shows the native multi-select file dialog.
 * Picked absolute paths are emitted as a JSON array; cancel/close emits
 * CANCELED. Single quotes in the initial dir are doubled for PS escaping.
 */
export function buildPickerScript(initialDir: string | undefined): string {
  const esc = (s: string) => s.replace(/'/g, "''")
  const lines = [
    // -EncodedCommand runs without a console, so stdout falls back to the
    // system ANSI codepage (GBK on zh-CN) which corrupts non-ASCII paths.
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    'Add-Type -AssemblyName System.Windows.Forms',
    // Without this, an OpenFileDialog shown as the process's first UI element
    // blocks without ever creating a visible window (pwsh WinForms quirk).
    '[System.Windows.Forms.Application]::EnableVisualStyles()',
    '$d = [System.Windows.Forms.OpenFileDialog]::new()',
    // Force the modern Explorer-style dialog. The default is true, but under
    // pwsh's non-interactive shell it can silently fall back to the legacy
    // flat list; being explicit keeps the picker looking like the OS dialog
    // (and like Electron apps' native pickers).
    '$d.AutoUpgradeEnabled = $true',
    '$d.Multiselect = $true',
    "$d.Title = '选择文件'",
    "$d.Filter = '所有文件 (*.*)|*.*'",
    '$d.RestoreDirectory = $true',
  ]
  if (initialDir !== undefined) {
    const quoted = `'${esc(initialDir)}'`
    lines.push(`if (Test-Path -LiteralPath ${quoted}) { $d.InitialDirectory = ${quoted} }`)
  }
  lines.push(
    '$r = $d.ShowDialog()',
    "if ($r -eq [System.Windows.Forms.DialogResult]::OK) { @($d.FileNames) | ConvertTo-Json -Compress } else { 'CANCELED' }",
  )
  return lines.join('\n')
}

/** Parse the pwsh stdout into a pick result; anything unrecognized is a cancel. */
export function parsePickerOutput(out: string): NativePickResult {
  const trimmed = out.trim()
  if (trimmed === '' || trimmed === 'CANCELED') return { paths: [], canceled: true }
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (typeof parsed === 'string') {
      // @() in the script forces arrays, but tolerate a bare JSON string
      // (single-element pipeline unwrap) defensively.
      return { paths: parsed === '' ? [] : [parsed], canceled: false }
    }
    const paths = Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : []
    return { paths, canceled: false }
  } catch {
    return { paths: [], canceled: true }
  }
}

/**
 * Show the native picker by running pwsh. The script is passed as a
 * UTF-16LE Base64 -EncodedCommand (pwsh-native, no temp file). After the
 * dialog closes, pwsh's exit is a timing race (it can linger on the
 * WinForms message pump), so we resolve on the first complete output line
 * and kill the process rather than waiting for a natural exit.
 */
export async function runNativePicker(initialDir: string | undefined, signal?: AbortSignal): Promise<NativePickResult> {
  const encoded = Buffer.from(buildPickerScript(initialDir), 'utf16le').toString('base64')
  return await new Promise((resolve, reject) => {
    const child = spawn('pwsh', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let settled = false
    const finish = (result: NativePickResult): void => {
      if (settled) return
      settled = true
      child.kill()
      resolve(result)
    }
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (data: string) => {
      out += data
      const trimmed = out.trim()
      if (trimmed === 'CANCELED') {
        finish({ paths: [], canceled: true })
        return
      }
      if (trimmed.startsWith('[') || trimmed.startsWith('"')) {
        try {
          finish({ paths: JSON.parse(trimmed) as string[], canceled: false })
        } catch {
          // Output line not complete yet; keep buffering.
        }
      }
    })
    child.on('error', (error) => {
      if (settled) return
      settled = true
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('PowerShell 7 (pwsh) not found on PATH; native file picker requires pwsh'))
        return
      }
      reject(error)
    })
    if (signal !== undefined) {
      signal.addEventListener('abort', () => {
        if (settled) return
        settled = true
        child.kill()
        reject(signal.reason)
      }, { once: true })
    }
    child.on('exit', () => {
      if (settled) return
      settled = true
      resolve(parsePickerOutput(out))
    })
  })
}
