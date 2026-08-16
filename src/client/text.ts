/**
 * Directory of the first picked path (for "remember last directory").
 * Windows picker returns backslash paths; returns undefined when unknown.
 */
export function lastDirOf(paths: readonly string[]): string | undefined {
  if (paths.length === 0) return undefined
  const idx = paths[0].lastIndexOf('\\')
  return idx > 0 ? paths[0].slice(0, idx) : undefined
}
