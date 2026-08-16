import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

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
    'Add-Type -AssemblyName System.Windows.Forms',
    // Without this, an OpenFileDialog shown as the process's first UI element
    // blocks without ever creating a visible window (pwsh WinForms quirk).
    '[System.Windows.Forms.Application]::EnableVisualStyles()',
    '$d = [System.Windows.Forms.OpenFileDialog]::new()',
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
 * UTF-16LE Base64 -EncodedCommand (pwsh-native, no temp file); feeding it
 * via stdin does not work here because execFile's input never closes the
 * pipe, so pwsh -Command - blocks forever waiting for EOF.
 */
export async function runNativePicker(initialDir: string | undefined, signal?: AbortSignal): Promise<NativePickResult> {
  let stdout: string
  try {
    const encoded = Buffer.from(buildPickerScript(initialDir), 'utf16le').toString('base64')
    const result = await execFileAsync('pwsh', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
      encoding: 'utf8',
      signal,
    })
    stdout = result.stdout
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('PowerShell 7 (pwsh) not found on PATH; native file picker requires pwsh')
    }
    throw error
  }
  return parsePickerOutput(stdout)
}
