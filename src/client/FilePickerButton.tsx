import { useState } from 'react'
import { nativePick } from './api.js'
import { addFiles } from './rail.js'
import { lastDirOf } from './text.js'

const LAST_DIR_KEY = 'dsh-file-picker.lastDir'

/**
 * Tool-row button: show the native Windows file dialog and stage the selected
 * files into the attachment rail (`rail.addFiles`); the rail's send button
 * injects them as context at send time. Draft is no longer mutated here.
 */
export function FilePickerButton() {
  const [picking, setPicking] = useState(false)

  const pick = async () => {
    if (picking) return
    setPicking(true)
    try {
      const initial = localStorage.getItem(LAST_DIR_KEY) ?? undefined
      const result = await nativePick(initial)
      if (!result.canceled && result.paths.length > 0) {
        const lastDir = lastDirOf(result.paths)
        if (lastDir !== undefined) localStorage.setItem(LAST_DIR_KEY, lastDir)
        addFiles(result.paths)
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
