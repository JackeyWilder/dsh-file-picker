// tests/client-api.spec.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { listFiles } from '../src/client/api.js'

afterEach(() => vi.restoreAllMocks())

describe('listFiles', () => {
  it('POSTs the path and returns entries', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ path: 'C:\\dev', entries: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await listFiles('C:\\dev')
    expect(fetchMock).toHaveBeenCalledWith('/api/dsh-file-picker/list', expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'C:\\dev' }),
    }))
    expect(result.path).toBe('C:\\dev')
  })
  it('throws a readable error on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'forbidden' }),
    }))
    await expect(listFiles('C:\\dev')).rejects.toThrow(/forbidden/)
  })
})
