import { useState } from 'react'
import { nativePick } from './api.js'
import { buildPathInjection, lastDirOf } from './text.js'

const LAST_DIR_KEY = 'dsh-file-picker.lastDir'

export interface FilePickerButtonProps {
  inputActions?: { setDraft(text: string): void }
  useInput?: { (selector: (s: { draft: string }) => string): string }
  sessionId?: string
}

/** Tool-row button: show the native Windows file dialog, inject @path: refs. */
export function FilePickerButton({ inputActions, useInput }: FilePickerButtonProps) {
  const [picking, setPicking] = useState(false)
  const draft = useInput ? useInput((s) => s.draft) : ''

  if (inputActions === undefined) return null

  const pick = async () => {
    if (picking) return
    setPicking(true)
    try {
      const initial = localStorage.getItem(LAST_DIR_KEY) ?? undefined
      const result = await nativePick(initial)
      if (!result.canceled && result.paths.length > 0) {
        const lastDir = lastDirOf(result.paths)
        if (lastDir !== undefined) localStorage.setItem(LAST_DIR_KEY, lastDir)
        inputActions.setDraft(buildPathInjection(result.paths, draft))
      }
    } catch (error) {
      console.error('[dsh-file-picker] pick failed:', error)
    } finally {
      setPicking(false)
    }
  }

  return (
    <button
      title={picking ? '正在选择…' : '选择文件'}
      aria-label="选择文件"
      onClick={() => void pick()}
      disabled={picking}
      style={{ background: 'transparent', border: 'none', cursor: picking ? 'wait' : 'pointer', color: '#888', padding: 4 }}
    >
      📎
    </button>
  )
}
