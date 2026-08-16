import { describe, it, expect } from 'vitest'
import { buildPickerScript, parsePickerOutput } from '../src/host/native-pick.js'

describe('buildPickerScript', () => {
  it('embeds the C# IFileOpenDialog interop in pure file mode', () => {
    const script = buildPickerScript(undefined)
    expect(script).toContain('IFileOpenDialog')
    expect(script).toContain('d57c7288-d4ad-4768-be02-9d969532d960')
    expect(script).toContain('GetResults')
    expect(script).toContain('0x200 | 0x40') // FOS_ALLOWMULTISELECT | FOS_FORCEFILESYSTEM
    expect(script).not.toContain('| 0x20)') // no FOS_PICKFOLDERS: file mode only
    expect(script).not.toContain('GetFileTypeCount') // IFileDialog has 23 methods
    expect(script).toContain('[FpPicker]::Show($null)')
    expect(script).toContain('CANCELED')
  })
  it('emits no initial-dir guard when initialDir is omitted', () => {
    expect(buildPickerScript(undefined)).not.toContain('Test-Path')
  })
  it('emits an initial-dir guard when provided, escaping single quotes', () => {
    const script = buildPickerScript("C:\\O'Brien\\dir")
    expect(script).toContain("Test-Path -LiteralPath 'C:\\O''Brien\\dir'")
    expect(script).toContain("[FpPicker]::Show('C:\\O''Brien\\dir')")
  })
})

describe('parsePickerOutput', () => {
  it('parses a JSON path array as picked', () => {
    const result = parsePickerOutput('["C:\\\\a.txt","C:\\\\b.txt"]')
    expect(result).toEqual({ paths: ['C:\\a.txt', 'C:\\b.txt'], canceled: false })
  })
  it('treats CANCELED as canceled with no paths', () => {
    expect(parsePickerOutput('CANCELED')).toEqual({ paths: [], canceled: true })
  })
  it('treats empty output as canceled', () => {
    expect(parsePickerOutput('  \n')).toEqual({ paths: [], canceled: true })
  })
  it('wraps a single JSON string path into a single-element array', () => {
    expect(parsePickerOutput('"C:\\\\a.txt"')).toEqual({ paths: ['C:\\a.txt'], canceled: false })
  })
  it('treats garbage output as canceled', () => {
    expect(parsePickerOutput('{oops')).toEqual({ paths: [], canceled: true })
  })
})
