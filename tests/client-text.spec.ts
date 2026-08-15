// tests/client-text.spec.ts
import { describe, it, expect } from 'vitest'
import { buildPathInjection, lastDirOf } from '../src/client/text.js'

describe('buildPathInjection', () => {
  it('injects a single path when draft is empty', () => {
    expect(buildPathInjection(['G:\\Dev\\a.txt'], '')).toBe('@path: G:\\Dev\\a.txt\n')
  })
  it('appends multiple paths on separate lines', () => {
    const result = buildPathInjection(['G:\\a.txt', 'G:\\b.txt'], '')
    expect(result).toBe('@path: G:\\a.txt\n@path: G:\\b.txt\n')
  })
  it('appends after an existing draft with a newline separator', () => {
    const result = buildPathInjection(['G:\\a.txt'], 'read this file')
    expect(result).toBe('read this file\n@path: G:\\a.txt\n')
  })
  it('keeps an existing trailing newline clean', () => {
    const result = buildPathInjection(['G:\\a.txt'], 'read this\n')
    expect(result).toBe('read this\n@path: G:\\a.txt\n')
  })
  it('returns the draft unchanged for an empty selection', () => {
    expect(buildPathInjection([], 'hi')).toBe('hi')
  })
})

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
