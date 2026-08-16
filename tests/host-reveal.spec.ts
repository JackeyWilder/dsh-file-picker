// tests/host-reveal.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: spawnMock }))

import { revealPath } from '../src/host/reveal.js'

beforeEach(() => {
  spawnMock.mockReset()
})

describe('revealPath', () => {
  it('spawns explorer with /select,"<path>", detached and unrefed', () => {
    const child = { unref: vi.fn() }
    spawnMock.mockReturnValue(child)
    revealPath('G:\\Dev\\project\\README.md')
    expect(spawnMock).toHaveBeenCalledWith('explorer', ['/select,"G:\\Dev\\project\\README.md"'], {
      windowsHide: true,
      detached: true,
    })
    expect(child.unref).toHaveBeenCalled()
  })
  it('quotes paths with spaces so explorer does not truncate them', () => {
    const child = { unref: vi.fn() }
    spawnMock.mockReturnValue(child)
    revealPath('C:\\My Docs\\a file.txt')
    expect(spawnMock).toHaveBeenCalledWith(
      'explorer',
      ['/select,"C:\\My Docs\\a file.txt"'],
      expect.objectContaining({ detached: true }),
    )
  })
})
