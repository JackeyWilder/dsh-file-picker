// src/host/inject.ts
/** One attached file as carried from the browser to the inject route. */
export interface AttachedFile {
  path: string
  name?: string
  size?: number
}

/** Durable source for the injected context message: plugin origin, notice form. */
export function buildInjectSource(): { kind: 'plugin'; plugin: string; form: 'notice' } {
  return { kind: 'plugin', plugin: 'dsh-file-picker', form: 'notice' }
}

/** Human-readable file list for the injected context text. */
export function buildInjectText(files: readonly AttachedFile[] | readonly string[]): string {
  if (files.length === 0) return ''
  const lines = files.map((entry) => {
    if (typeof entry === 'string') return `- ${entry}`
    const size = typeof entry.size === 'number' ? ` (${entry.size} B)` : ''
    return `- ${entry.name ?? entry.path}${size}：${entry.path}`
  })
  return '用户附加了文件，请按需读取其内容（绝对路径如下）：\n' + lines.join('\n')
}
