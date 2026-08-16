// src/host/log.ts
// Minimal append-only diagnostic log for the plugin's host half. The log file
// lives under the dsh home directory (next to sessions/), so a session export
// or the log itself pinpoints which stage of the stage → inbox-inserted →
// inject pipeline ran. Best-effort: a write failure must never break the
// plugin's routes or listeners.
//
// Privacy default: full absolute paths are NOT written by default. Paths are
// redacted to their drive + basename (`G:\...\README.md`), which keeps the
// debug signal (which file, which session) without recording the user's full
// directory tree. Set DSH_FILE_PICKER_DEBUG=1 to log full paths.
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Rotate the log past this size: the file is renamed to *.1 and restarted. */
const MAX_LOG_BYTES = 1024 * 1024

const logDir = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const logPath = join(logDir, 'logs', 'dsh-file-picker.log')

/** Opt into full-path logging; absent/0 logs redacted paths only. */
const debugLogging = process.env.DSH_FILE_PICKER_DEBUG === '1'

/**
 * Plugin version, read from the installed package.json so it can never drift
 * from the published version (single source of truth). `lib/` sits next to
 * `package.json` both in the published tarball and in `link:` installs, so
 * `../package.json` resolves in both layouts.
 */
function readPluginVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: string }
    return typeof pkg.version === 'string' && pkg.version !== '' ? pkg.version : 'unknown'
  } catch {
    return 'unknown'
  }
}

/** Plugin version, embedded in every log line to prove which bundle ran. */
export const PLUGIN_VERSION = readPluginVersion()

/**
 * Redact an absolute path for privacy-safe logging: drive + `...` + basename.
 * `G:\Dev\project\src\README.md` → `G:\...\README.md`. Full paths are logged
 * only when DSH_FILE_PICKER_DEBUG=1.
 */
export function redactPath(path: string): string {
  const drive = /^[A-Za-z]:/.exec(path)?.[0]
  const base = path.slice(drive === undefined ? 0 : drive.length).split(/[\\/]/).filter(Boolean).pop() ?? ''
  return drive === undefined ? `...\\${base}` : `${drive}\\...\\${base}`
}

export function hostLog(line: string): void {
  try {
    mkdirSync(join(logDir, 'logs'), { recursive: true })
    if (existsSync(logPath) && statSync(logPath).size > MAX_LOG_BYTES) {
      renameSync(logPath, `${logPath}.1`)
    }
    appendFileSync(logPath, `${new Date().toISOString()} [${PLUGIN_VERSION}] ${line}\n`, 'utf8')
  } catch {
    // diagnostics only
  }
}

/** Redact a list of file paths per the privacy default (debug off). */
export function redactList(paths: readonly string[]): string {
  return paths.map(debugLogging ? (p) => p : redactPath).join(' | ')
}
