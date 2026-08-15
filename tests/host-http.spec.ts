// tests/host-http.spec.ts
import { describe, it, expect } from 'vitest'
import { Readable } from 'node:stream'
import { isLoopbackRequest, readJsonBody } from '../src/host/http.js'

function fakeReq(remoteAddress: string, host: string, headers: Record<string, string | undefined> = {}, body?: string) {
  const req = Object.assign(Readable.from(body ?? ''), {
    socket: { remoteAddress },
    headers: { host, ...headers },
  })
  return req as never
}

describe('isLoopbackRequest', () => {
  it('accepts 127.0.0.1 with localhost host header', () => {
    expect(isLoopbackRequest(fakeReq('127.0.0.1', 'localhost:3080'))).toBe(true)
  })
  it('rejects a LAN remote address', () => {
    expect(isLoopbackRequest(fakeReq('192.168.1.5', 'localhost:3080'))).toBe(false)
  })
  it('rejects cross-site fetch', () => {
    expect(isLoopbackRequest(fakeReq('127.0.0.1', 'localhost:3080', { 'sec-fetch-site': 'cross-site' }))).toBe(false)
  })
  it('accepts missing origin (curl / same-tab navigation)', () => {
    expect(isLoopbackRequest(fakeReq('127.0.0.1', 'localhost:3080'))).toBe(true)
  })
})

describe('readJsonBody', () => {
  it('parses a JSON body', async () => {
    const body = await readJsonBody(fakeReq('127.0.0.1', 'localhost:3080', {}, JSON.stringify({ path: 'C:\\dev' })))
    expect(body).toEqual({ path: 'C:\\dev' })
  })
  it('returns undefined on malformed JSON', async () => {
    const body = await readJsonBody(fakeReq('127.0.0.1', 'localhost:3080', {}, '{oops'))
    expect(body).toBeUndefined()
  })
})
