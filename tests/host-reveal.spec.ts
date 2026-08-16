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

describe('revealPath', () => {
  it('spawns explorer through the shell with /select,"<path>", detached and unrefed', () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    revealPath('G:\\Dev\\project\\README.md')
    expect(spawnMock).toHaveBeenCalledWith(
      'explorer',
      ['/select,"G:\\Dev\\project\\README.md"'],
      {
        windowsHide: true,
        detached: true,
        stdio: 'ignore',
        shell: true,
      },
    )
    expect(child.unref).toHaveBeenCalled()
  })

  it('quotes paths with spaces so explorer does not truncate them', () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    revealPath('C:\\My Docs\\a file.txt')
    expect(spawnMock).toHaveBeenCalledWith(
      'explorer',
      ['/select,"C:\\My Docs\\a file.txt"'],
      expect.objectContaining({ detached: true, shell: true, stdio: 'ignore' }),
    )
  })

  it('doubles % so cmd cannot expand env-like segments in the path', () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    revealPath('C:\\a%b\\file.txt')
    expect(spawnMock).toHaveBeenCalledWith('explorer', ['/select,"C:\\a%%b\\file.txt"'], expect.anything())
  })
})