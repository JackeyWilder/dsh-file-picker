// src/host/log.ts
// Minimal append-only diagnostic log for the plugin's host half. The log file
// lives under the dsh home directory (next to sessions/), so a session export
// or the log itself pinpoints which stage of the stage → inbox-inserted →
// inject pipeline ran. Best-effort: a write failure must never break the
// plugin's routes or listeners.
import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Build-time identity, embedded so the log can prove which host bundle ran. */
export const PLUGIN_VERSION = '0.1.0'

const logDir = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const logPath = join(logDir, 'logs', 'dsh-file-picker.log')

export function hostLog(line: string): void {
  try {
    mkdirSync(join(logDir, 'logs'), { recursive: true })
    appendFileSync(logPath, `${new Date().toISOString()} [${PLUGIN_VERSION}] ${line}\n`, 'utf8')
  } catch {
    // diagnostics only
  }
}
