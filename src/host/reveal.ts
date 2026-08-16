// src/host/reveal.ts
import { spawn } from 'node:child_process'

/**
 * Reveal a file in Windows Explorer (opens the folder with the file
 * selected).
 *
 * Why `shell: true` (2026-08-17, verified live): spawn() itself does not go
 * through a shell, but Node's libuv still quotes-and-escapes argv entries
 * that contain spaces — an internal `"` becomes `\"`, so explorer.exe
 * receives `"/select,\"C:\path with space\file\""` and cannot parse it. The
 * process starts, shows no window, and lingers forever. With `shell: true`
 * the args are passed to cmd.exe which forwards the quoted segment verbatim,
 * and explorer opens the folder correctly. (Confirmed experimentally: same
 * path, no-window process without shell vs. a real window with shell.)
 *
 * The only variable input is the path picked through the native dialog.
 * cmd-safety: `%` is doubled so cmd cannot expand env-like segments;
 * `&|<>^` are inert inside the double-quoted arg; `"` is doubled as a
 * belt-and-braces guard (NTFS filenames cannot contain it anyway). No shell
 * metacharacter is ever attacker-controllable outside the quoted segment.
 */
export function revealPath(path: string): void {
  const arg = `/select,"${path.replace(/"/g, '""').replace(/%/g, '%%')}"`
  const child = spawn('explorer', [arg], {
    windowsHide: true,
    detached: true,
    stdio: 'ignore',
    shell: true,
  })
  // spawn() reports ENOENT etc. asynchronously via 'error'; without a
  // listener an unhandled 'error' would crash the host process.
  child.on('error', () => {})
  child.unref()
}