import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn: spawnMock }))

import { runNativePicker, PICKER_STUCK_TIMEOUT_MS } from '../src/host/native-pick.js'

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
  vi.useFakeTimers()
  spawnMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
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
    await vi.advanceTimersByTimeAsync(1)
    await expect(promise).resolves.toEqual({ paths: ['C:\\a.txt', 'C:\\b.txt'], canceled: false })
    expect(child.kill).toHaveBeenCalled()
  })

  it('buffers split output chunks until the JSON line is complete', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    const promise = runNativePicker(undefined)
    child.stdout.emit('data', '["C:\\\\')
    child.stdout.emit('data', 'a.txt"]')
    await vi.advanceTimersByTimeAsync(1)
    await expect(promise).resolves.toEqual({ paths: ['C:\\a.txt'], canceled: false })
    expect(child.kill).toHaveBeenCalled()
  })

  it('resolves as canceled and reaps pwsh when the dialog never produces output', async () => {
    const child = fakeChild()
    spawnMock.mockReturnValue(child)
    const promise = runNativePicker(undefined)
    await vi.advanceTimersByTimeAsync(PICKER_STUCK_TIMEOUT_MS + 1)
    await expect(promise).resolves.toEqual({ paths: [], canceled: true })
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
