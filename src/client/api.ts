import type { FileEntry } from '../host/list.js'

export interface ListFilesResult {
  path: string
  parent: string | null
  home: string
  entries: FileEntry[]
}

/**
 * List one directory through the host route. Same-origin fetch; the host
 * fence accepts loopback pages.
 */
export async function listFiles(path: string | undefined): Promise<ListFilesResult> {
  const response = await fetch('/api/dsh-file-picker/list', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(path === undefined ? {} : { path }),
  })
  const body = (await response.json()) as Partial<ListFilesResult> & { error?: string }
  if (!response.ok) {
    throw new Error(body.error ?? `list failed: HTTP ${response.status}`)
  }
  return body as ListFilesResult
}
