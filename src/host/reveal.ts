// src/host/reveal.ts
import { spawn } from 'node:child_process'

/**
 * Reveal a file in Windows Explorer (opens the folder with the file
 * selected) by spawning `explorer /select,"<path>"`. The path is wrapped in
 * double quotes because explorer.exe parses its own command line by spaces —
 * even though spawn() does not go through a shell, an unquoted path with
 * spaces is truncated at the first space. `detached: true` lets the spawned
 * explorer outlive this short-lived host process; no shell is involved.
 */
export function revealPath(path: string): void {
  const quoted = `"${path.replace(/"/g, '""')}"`
  const child = spawn('explorer', [`/select,${quoted}`], {
    windowsHide: true,
    detached: true,
  })
  child.unref()
}
