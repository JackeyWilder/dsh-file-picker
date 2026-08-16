import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: spawnMock }))

import { runNativePicker } from '../src/host/native-pick.js'

function fakeChild() {
  const child = new EventEmitter() as unknown as {
    stdout: EventEmitter & { setEncoding: ReturnType<typeof vi.fn> }
    kill: ReturnType<typeof vi.fn>
    on: EventEmitter['on']
  }
  child.stdout = Object.assign(new EventEmitter(), { setEncoding: vi.fn() })
  child.kill = vi.fn(() => true)
  return child
}

beforeEach(() => {
  spawnMock.mockReset()
})

describe('runNativePicker', () => {
  it('resolves canceled and kills pwsh when CANCELED is emitted', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    const promise = runNativePicker(undefined)
    child.stdout.emit('data', 'CANCELED')
    await expect(promise).resolves.toEqual({ paths: [], canceled: true })
    expect(child.kill).toHaveBeenCalled()
  })

  it('resolves picked paths and kills pwsh when a JSON array is emitted', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    const promise = runNativePicker(undefined)
    child.stdout.emit('data', '["C:\\\\a.txt","C:\\\\b.txt"]')
    await expect(promise).resolves.toEqual({ paths: ['C:\\a.txt', 'C:\\b.txt'], canceled: false })
    expect(child.kill).toHaveBeenCalled()
  })

  it('buffers split output chunks until the JSON line is complete', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    const promise = runNativePicker(undefined)
    child.stdout.emit('data', '["C:\\\\')
    child.stdout.emit('data', 'a.txt"]')
    await expect(promise).resolves.toEqual({ paths: ['C:\\a.txt'], canceled: false })
    expect(child.kill).toHaveBeenCalled()
  })

  it('rejects with a readable error when pwsh is not on PATH', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    const promise = runNativePicker(undefined)
    child.emit('error', Object.assign(new Error('spawn pwsh ENOENT'), { code: 'ENOENT' }))
    await expect(promise).rejects.toThrow(/pwsh.*not found/)
  })

  it('falls back to parsing buffered output on natural exit', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    const promise = runNativePicker(undefined)
    child.stdout.emit('data', 'CANCELED')
    child.emit('exit', 0)
    await expect(promise).resolves.toEqual({ paths: [], canceled: true })
  })
})
