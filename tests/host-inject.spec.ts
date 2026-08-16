// tests/host-inject.spec.ts
import { describe, it, expect } from 'vitest'
import { buildInjectText, buildInjectSource } from '../src/host/inject.js'

describe('buildInjectText', () => {
  it('renders the file list with absolute paths', () => {
    const text = buildInjectText(['G:\\a.txt', 'G:\\b.md'])
    expect(text).toContain('用户附加了文件')
    expect(text).toContain('G:\\a.txt')
    expect(text).toContain('G:\\b.md')
  })
  it('renders names and sizes when present', () => {
    const text = buildInjectText([{ path: 'G:\\a.txt', name: 'a.txt', size: 5 }])
    expect(text).toContain('a.txt (5 B)')
  })
  it('returns empty for an empty list', () => {
    expect(buildInjectText([])).toBe('')
  })
})

describe('buildInjectSource', () => {
  it('carries plugin kind, notice form, and a collapsed-row summary', () => {
    const source = buildInjectSource()
    expect(source).toEqual({
      kind: 'plugin',
      plugin: 'dsh-file-picker',
      form: 'notice',
      summary: '附加了文件，请按需读取',
    })
  })
})
