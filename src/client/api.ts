export interface NativePickResult {
  paths: string[]
  canceled: boolean
}

/**
 * Show the native picker through the host route (same-origin POST). The host
 * spawns pwsh; cancel and empty selection both return `canceled: true`.
 */
export async function nativePick(initialDir: string | undefined): Promise<NativePickResult> {
  const response = await fetch('/api/dsh-file-picker/native-pick', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(initialDir === undefined ? {} : { initialDir }),
  })
  const body = (await response.json()) as Partial<NativePickResult> & { error?: string }
  if (!response.ok) {
    throw new Error(body.error ?? `native pick failed: HTTP ${response.status}`)
  }
  return body as NativePickResult
}
