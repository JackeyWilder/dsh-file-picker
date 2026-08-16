// tests/client-rail.spec.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { addFiles, baseNameOf, clear, getSnapshot, removeFile, subscribe } from '../src/client/rail.js'

beforeEach(() => clear())

describe('addFiles', () => {
  it('adds files and derives a display name', () => {
    const files = addFiles(['G:\\Dev\\a.txt'])
    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({ path: 'G:\\Dev\\a.txt', name: 'a.txt' })
  })
  it('merges new paths and dedupes on absolute path', () => {
    addFiles(['G:\\a.txt'])
    const files = addFiles(['G:\\a.txt', 'G:\\b.txt'])
    expect(files.map((f) => f.path)).toEqual(['G:\\a.txt', 'G:\\b.txt'])
  })
  it('keeps the snapshot reference stable for an empty selection', () => {
    const before = getSnapshot()
    expect(addFiles([])).toBe(before)
  })
  it('ignores blank entries', () => {
    const files = addFiles(['G:\\a.txt', '', 'G:\\b.txt'])
    expect(files.map((f) => f.path)).toEqual(['G:\\a.txt', 'G:\\b.txt'])
  })
})

describe('removeFile / clear / snapshot', () => {
  it('removes one path and keeps the rest', () => {
    addFiles(['G:\\a.txt', 'G:\\b.txt'])
    const files = removeFile('G:\\a.txt')
    expect(files.map((f) => f.path)).toEqual(['G:\\b.txt'])
  })
  it('is a silent no-op for an unknown path', () => {
    addFiles(['G:\\a.txt'])
    let notified = 0
    const unsub = subscribe(() => {
      notified += 1
    })
    const before = getSnapshot()
    expect(removeFile('G:\\missing.txt')).toBe(before)
    expect(notified).toBe(0)
    unsub()
  })
  it('clear empties the list', () => {
    addFiles(['G:\\a.txt', 'G:\\b.txt'])
    clear()
    expect(getSnapshot()).toEqual([])
  })
})


describe('subscription', () => {
  it('notifies listeners on add, remove, and clear', () => {
    let notified = 0
    const unsub = subscribe(() => {
      notified += 1
    })
    addFiles(['G:\\a.txt'])
    removeFile('G:\\a.txt')
    addFiles(['G:\\b.txt'])
    clear()
    expect(notified).toBe(4)
    unsub()
  })
  it('unsubscribe stops notifications', () => {
    let notified = 0
    const unsub = subscribe(() => {
      notified += 1
    })
    unsub()
    addFiles(['G:\\a.txt'])
    expect(notified).toBe(0)
  })
})

describe('baseNameOf', () => {
  it('handles backslash and forward-slash paths', () => {
    expect(baseNameOf('G:\\Dev\\a.txt')).toBe('a.txt')
    expect(baseNameOf('G:/Dev/b.txt')).toBe('b.txt')
  })
  it('handles a bare file name', () => {
    expect(baseNameOf('a.txt')).toBe('a.txt')
  })
  it('strips a trailing separator', () => {
    expect(baseNameOf('G:\\Dev\\dir\\')).toBe('dir')
  })
})
