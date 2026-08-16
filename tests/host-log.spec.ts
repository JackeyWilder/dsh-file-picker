// tests/host-log.spec.ts
import { describe, it, expect } from 'vitest'
import { redactList, redactPath } from '../src/host/log.js'

describe('redactPath', () => {
  it('redacts a Windows absolute path to drive + ... + basename', () => {
    expect(redactPath('G:\\Dev\\project\\src\\README.md')).toBe('G:\\...\\README.md')
  })
  it('redacts a POSIX path', () => {
    expect(redactPath('/home/user/secret/data.txt')).toBe('...\\data.txt')
  })
  it('keeps a bare filename', () => {
    expect(redactPath('notes.txt')).toBe('...\\notes.txt')
  })
  it('handles a drive-rooted path without a basename', () => {
    expect(redactPath('C:\\')).toBe('C:\\...\\')
  })
})

describe('redactList', () => {
  it('joins redacted paths', () => {
    expect(redactList(['G:\\a\\b.txt', 'D:\\c\\d.md'])).toBe('G:\\...\\b.txt | D:\\...\\d.md')
  })
})
