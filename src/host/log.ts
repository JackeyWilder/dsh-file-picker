// src/host/log.ts
// Minimal append-only diagnostic log for the plugin's host half. The log file
// lives under the dsh home directory (next to sessions/), so a session export
// or the log itself pinpoints which stage of the stage → inbox-inserted →
// inject pipeline ran. Best-effort: a write failure must never break the
// plugin's routes or listeners.
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Rotate the log past this size: the file is renamed to *.1 and restarted. */
const MAX_LOG_BYTES = 1024 * 1024

const logDir = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const logPath = join(logDir, 'logs', 'dsh-file-picker.log')

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
