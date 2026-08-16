import { describe, it, expect } from 'vitest'
import { buildPickerScript, parsePickerOutput } from '../src/host/native-pick.js'

describe('buildPickerScript', () => {
  it('emits a multi-select OpenFileDialog with our copy', () => {
    const script = buildPickerScript(undefined)
    expect(script).toContain('[System.Windows.Forms.OpenFileDialog]::new()')
    expect(script).toContain('[System.Windows.Forms.Application]::EnableVisualStyles()')
    expect(script).toContain('$d.AutoUpgradeEnabled = $true')
    expect(script).toContain('$d.Multiselect = $true')
    expect(script).toContain("$d.Title = '选择文件'")
    expect(script).toContain("$d.Filter = '所有文件 (*.*)|*.*'")
    expect(script).toContain('CANCELED')
  })
  it('shows the dialog on a transparent TopMost owner so foreground-lock cannot bury it', () => {
    const script = buildPickerScript(undefined)
    expect(script).toContain('$owner.TopMost = $true')
    expect(script).toContain('$owner.ShowInTaskbar = $false')
    expect(script).toContain('$owner.Opacity = 0')
    expect(script).toContain('$d.ShowDialog($owner)')
    expect(script).toContain('$owner.Dispose()')
    expect(script).toContain('$d.Dispose()')
  })
  it('wraps FileNames in @() so a single-file pick emits a JSON array', () => {
    expect(buildPickerScript(undefined)).toContain('@($d.FileNames)')
  })
  it('emits no InitialDirectory when initialDir is omitted', () => {
    expect(buildPickerScript(undefined)).not.toContain('InitialDirectory')
  })
  it('emits an InitialDirectory guard when provided, escaping single quotes', () => {
    const script = buildPickerScript("C:\\O'Brien\\dir")
    expect(script).toContain("Test-Path -LiteralPath 'C:\\O''Brien\\dir'")
    expect(script).toContain("$d.InitialDirectory = 'C:\\O''Brien\\dir'")
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
