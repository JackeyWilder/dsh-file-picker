// tests/client-text.spec.ts
import { describe, it, expect } from 'vitest'
import { lastDirOf } from '../src/client/text.js'

describe('lastDirOf', () => {
  it('takes the directory of the first picked path', () => {
    expect(lastDirOf(['C:\\dev\\a.txt', 'C:\\dev\\b.txt'])).toBe('C:\\dev')
  })
  it('returns undefined when the path has no backslash', () => {
    expect(lastDirOf(['C:file.txt'])).toBeUndefined()
  })
  it('returns undefined for an empty selection', () => {
    expect(lastDirOf([])).toBeUndefined()
  })
})
