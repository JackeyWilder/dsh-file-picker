/**
 * Compose the next draft after picking files: append one `@path: <abs>` line
 * per selected file. An empty selection leaves the draft untouched.
 */
export function buildPathInjection(paths: readonly string[], draft: string): string {
  if (paths.length === 0) return draft
  const lines = paths.map((p) => `@path: ${p}`).join('\n')
  if (draft === '') return `${lines}\n`
  return `${draft.replace(/\s+$/, '')}\n${lines}\n`
}

/**
 * Directory of the first picked path (for "remember last directory").
 * Windows picker returns backslash paths; returns undefined when unknown.
 */
export function lastDirOf(paths: readonly string[]): string | undefined {
  if (paths.length === 0) return undefined
  const idx = paths[0].lastIndexOf('\\')
  return idx > 0 ? paths[0].slice(0, idx) : undefined
}
