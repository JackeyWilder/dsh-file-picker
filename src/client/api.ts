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
 * Stage (replace) the rail's current cards on the host for one session. The
 * host injects the staged paths when that session's next real user message
 * enters the inbox — send-time injection without the browser racing the input
 * machine's phase transitions. Throws a readable error on a non-ok response.
 */
export async function stageFiles(sessionId: string, paths: readonly string[] | string): Promise<void> {
  const list = Array.isArray(paths) ? paths : [paths]
  const response = await fetch('/api/dsh-file-picker/stage', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, files: list.map((path) => ({ path })) }),
  })
  const body = (await response.json()) as { error?: string }
  if (!response.ok) {
    throw new Error(body.error ?? `stage failed: HTTP ${response.status}`)
  }
}

/** Drop a session's staged list on the host (rail cleared without a send). */
export async function unstageFiles(sessionId: string): Promise<void> {
  const response = await fetch('/api/dsh-file-picker/unstage', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  })
  const body = (await response.json()) as { error?: string }
  if (!response.ok) {
    throw new Error(body.error ?? `unstage failed: HTTP ${response.status}`)
  }
}

/**
 * Ask the host to reveal a file in Windows Explorer (folder opened with the
 * file selected). Loopback-only host route; failure is reported, never thrown
 * to the caller's critical path.
 */
export async function revealPath(path: string): Promise<void> {
  try {
    const response = await fetch('/api/dsh-file-picker/reveal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    const body = (await response.json()) as { error?: string }
    if (!response.ok) {
      console.error(`[dsh-file-picker] reveal failed: ${body.error ?? `HTTP ${response.status}`}`)
    }
  } catch (error) {
    console.error('[dsh-file-picker] reveal failed:', error)
  }
}
