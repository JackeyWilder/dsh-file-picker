// tests/host-reveal.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: spawnMock }))

import { revealPath } from '../src/host/reveal.js'

beforeEach(() => {
  spawnMock.mockReset()
})

function fakeChild(): EventEmitter {
  const child = new EventEmitter()
  child.unref = vi.fn()
  return child as EventEmitter & { unref: ReturnType<typeof vi.fn> }
}

/** Decode the -EncodedCommand payload the same way pwsh would. */
function decodeEncodedCommand(call: unknown[]): string {
  const args = (call as Array<unknown>)[1] as string[]
  const b64 = args[args.indexOf('-EncodedCommand') + 1]
  return Buffer.from(b64, 'base64').toString('utf16le')
}

describe('revealPath', () => {
  it('spawns pwsh with an encoded script that runs Start-Process explorer', () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    revealPath('G:\\Dev\\project\\README.md')
    expect(spawnMock).toHaveBeenCalledWith(
      'pwsh',
      expect.arrayContaining(['-NoProfile', '-NonInteractive', '-EncodedCommand', expect.any(String)]),
      {
        windowsHide: true,
        stdio: 'ignore',
      },
    )
    expect(child.unref).toHaveBeenCalled()
  })

  it('embeds the path and parent dir in the script, quotes them for /select, and unlocks the foreground', () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    revealPath('C:\\My Docs\\a file.txt')
    const script = decodeEncodedCommand(spawnMock.mock.calls[0])
    expect(script).toContain("$p = 'C:\\My Docs\\a file.txt'")
    expect(script).toContain("$dir = 'C:\\My Docs'")
    expect(script).toContain("$arg = '/select,\"' + $p + '\"'")
    expect(script).toContain('Start-Process -FilePath explorer.exe -ArgumentList $arg')
    // Foreground unlock: poll for the window (matched on the parent dir —
    // explorer titles never include the file name), restore, ALT-unlock, activate.
    expect(script).toContain('$_.MainWindowTitle.Contains($dir)')
    expect(script).toContain('[FpReveal]::ShowWindow($win.MainWindowHandle, 9)')
    expect(script).toContain('[FpReveal]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)')
    expect(script).toContain('[FpReveal]::SetForegroundWindow($win.MainWindowHandle)')
  })

  it("doubles single quotes in the path so the pwsh string literal stays intact", () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    revealPath("C:\\it's here\\file.txt")
    const script = decodeEncodedCommand(spawnMock.mock.calls[0])
    expect(script).toContain("$p = 'C:\\it''s here\\file.txt'")
  })
})