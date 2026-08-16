// tests/client-api.spec.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { nativePick, injectFiles } from '../src/client/api.js'

afterEach(() => vi.restoreAllMocks())

describe('nativePick', () => {
  it('POSTs the initial dir and returns paths + canceled', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ paths: ['C:\\dev\\a.txt', 'C:\\dev\\b.txt'], canceled: false }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await nativePick('C:\\dev')
    expect(fetchMock).toHaveBeenCalledWith('/api/dsh-file-picker/native-pick', expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initialDir: 'C:\\dev' }),
    }))
    expect(result).toEqual({ paths: ['C:\\dev\\a.txt', 'C:\\dev\\b.txt'], canceled: false })
  })
  it('throws a readable error on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'forbidden' }),
    }))
    await expect(nativePick('C:\\dev')).rejects.toThrow(/forbidden/)
  })
})

describe('injectFiles', () => {
  it('POSTs the session id and path entries', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await injectFiles('session-1', ['C:\\dev\\a.txt', 'C:\\dev\\b.txt'])
    expect(fetchMock).toHaveBeenCalledWith('/api/dsh-file-picker/inject', expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'session-1',
        files: [{ path: 'C:\\dev\\a.txt' }, { path: 'C:\\dev\\b.txt' }],
      }),
    }))
  })
  it('throws a readable error on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'agent not found for session: session-1' }),
    }))
    await expect(injectFiles('session-1', ['C:\\dev\\a.txt'])).rejects.toThrow(/agent not found/)
  })
})
