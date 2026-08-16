// src/host/reveal.ts
import { spawn } from 'node:child_process'

/**
 * Reveal a file in Windows Explorer (opens the folder with the file
 * selected) by spawning `explorer /select,<path>`. `detached: true` lets the
 * spawned explorer outlive this short-lived host process and return to the
 * caller immediately; no shell is involved, so spaces/quotes in the path are
 * passed verbatim.
 */
export function revealPath(path: string): void {
  const child = spawn('explorer', [`/select,${path}`], {
    windowsHide: true,
    detached: true,
  })
  child.unref()
}
