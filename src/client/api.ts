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

/**
 * Push staged files into the session as an injected plugin context message
 * (send-time injection, host route `/api/dsh-file-picker/inject`). Throws a
 * readable error on a non-ok response, mirroring `nativePick`.
 */
export async function injectFiles(sessionId: string, paths: readonly string[]): Promise<void> {
  const response = await fetch('/api/dsh-file-picker/inject', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, files: paths.map((path) => ({ path })) }),
  })
  const body = (await response.json()) as { error?: string }
  if (!response.ok) {
    throw new Error(body.error ?? `inject failed: HTTP ${response.status}`)
  }
}
