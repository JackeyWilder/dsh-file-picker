// tests/client-rail.spec.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { addFiles, baseNameOf, clear, getSnapshot, moveCard, moveCardToTop, removeFile, subscribe } from '../src/client/rail.js'

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

describe('moveCard', () => {
  const seed = () => addFiles(['G:\\a.txt', 'G:\\b.txt', 'G:\\c.txt'])

  it('moves a card up by one', () => {
    seed()
    const files = moveCard('G:\\b.txt', -1)
    expect(files.map((f) => f.path)).toEqual(['G:\\b.txt', 'G:\\a.txt', 'G:\\c.txt'])
  })
  it('moves a card down by one', () => {
    seed()
    const files = moveCard('G:\\a.txt', 1)
    expect(files.map((f) => f.path)).toEqual(['G:\\b.txt', 'G:\\a.txt', 'G:\\c.txt'])
  })
  it('is a no-op at the top edge going up', () => {
    seed()
    const before = getSnapshot()
    expect(moveCard('G:\\a.txt', -1)).toBe(before)
  })
  it('is a no-op at the bottom edge going down', () => {
    seed()
    const before = getSnapshot()
    expect(moveCard('G:\\c.txt', 1)).toBe(before)
  })
  it('is a silent no-op for an unknown path', () => {
    seed()
    let notified = 0
    const unsub = subscribe(() => { notified += 1 })
    const before = getSnapshot()
    expect(moveCard('G:\\missing.txt', -1)).toBe(before)
    expect(notified).toBe(0)
    unsub()
  })
  it('notifies listeners on a move', () => {
    seed()
    let notified = 0
    const unsub = subscribe(() => { notified += 1 })
    moveCard('G:\\b.txt', -1)
    expect(notified).toBe(1)
    unsub()
  })
})

describe('moveCardToTop', () => {
  const seed = () => addFiles(['G:\\a.txt', 'G:\\b.txt', 'G:\\c.txt'])

  it('moves a card to the front', () => {
    seed()
    const files = moveCardToTop('G:\\c.txt')
    expect(files.map((f) => f.path)).toEqual(['G:\\c.txt', 'G:\\a.txt', 'G:\\b.txt'])
  })
  it('is a no-op for the card already at the front', () => {
    seed()
    const before = getSnapshot()
    expect(moveCardToTop('G:\\a.txt')).toBe(before)
  })
  it('is a silent no-op for an unknown path', () => {
    seed()
    let notified = 0
    const unsub = subscribe(() => { notified += 1 })
    const before = getSnapshot()
    expect(moveCardToTop('G:\\missing.txt')).toBe(before)
    expect(notified).toBe(0)
    unsub()
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
