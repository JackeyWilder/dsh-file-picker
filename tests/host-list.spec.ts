import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listDirectory } from '../src/host/list.js'

let dir: string

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dsh-fp-'))
  await mkdir(join(dir, 'sub'))
  await writeFile(join(dir, 'a.txt'), 'hello')
  await writeFile(join(dir, '.hidden'), 'x')
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('listDirectory', () => {
  it('lists files and directories with metadata', async () => {
    const listing = await listDirectory(dir)
    const names = listing.entries.map((e) => e.name).sort()
    expect(names).toEqual(['.hidden', 'a.txt', 'sub'])
    const file = listing.entries.find((e) => e.name === 'a.txt')!
    expect(file.isDirectory).toBe(false)
    expect(file.size).toBe(5)
    expect(file.hidden).toBe(false)
    const sub = listing.entries.find((e) => e.name === 'sub')!
    expect(sub.isDirectory).toBe(true)
    const hidden = listing.entries.find((e) => e.name === '.hidden')!
    expect(hidden.hidden).toBe(true)
  })
  it('returns absolute paths and the parent', async () => {
    const listing = await listDirectory(dir)
    expect(listing.entries.every((e) => e.path.startsWith(dir))).toBe(true)
    expect(listing.parent).toBe(join(dir, '..'))
  })
  it('defaults to the home directory when path is omitted', async () => {
    const listing = await listDirectory(undefined)
    expect(listing.home).toBeTruthy()
    expect(listing.path).toBe(listing.home)
  })
  it('throws a clear error for a missing path', async () => {
    await expect(listDirectory(join(dir, 'nope'))).rejects.toThrow()
  })
})
