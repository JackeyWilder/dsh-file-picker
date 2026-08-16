// src/host/inject.ts
/** One attached file as carried from the browser to the inject route. */
export interface AttachedFile {
  path: string
  name?: string
  size?: number
}

/**
 * Durable source for the injected context message: plugin origin, notice form.
 * `summary` is the collapsed-row account the notice renders without expanding
 * (ui-conversation's noticeSummary reads it off the durable source).
 */
export function buildInjectSource(): { kind: 'plugin'; plugin: string; form: 'notice'; summary: string } {
  return { kind: 'plugin', plugin: 'dsh-file-picker', form: 'notice', summary: '附加了文件，请按需读取' }
}

/** Human-readable file list for the injected context text. */
export function buildInjectText(files: readonly AttachedFile[] | readonly string[] | string): string {
  const list = Array.isArray(files) ? files : [files]
  if (list.length === 0) return ''
  const lines = list
    .filter((entry): entry is AttachedFile | string => typeof entry === 'string' || (typeof entry === 'object' && entry !== null && typeof entry.path === 'string'))
    .map((entry) => {
      if (typeof entry === 'string') return `- ${entry}`
      const size = typeof entry.size === 'number' ? ` (${entry.size} B)` : ''
      return `- ${entry.name ?? entry.path}${size}：${entry.path}`
    })
  return '用户附加了文件，请按需读取其内容（绝对路径如下）：\n' + lines.join('\n')
}
