import { useState } from 'react'
import { FilePickerDialog } from './FilePickerDialog.js'
import { buildPathInjection } from './text.js'

export interface FilePickerButtonProps {
  /** input 标准提供通道（ui-conversation provide：hooks 'input'，props 'inputActions'）。 */
  inputActions?: { setDraft(text: string): void }
  /** 当前草稿（读 draft 追加）。 */
  useInput?: { (selector: (s: { draft: string }) => string): string }
  sessionId?: string
}

/** Tool-row button: open the file browser, inject @path: refs into the draft. */
export function FilePickerButton({ inputActions, useInput }: FilePickerButtonProps) {
  const [open, setOpen] = useState(false)
  const draft = useInput ? useInput((s) => s.draft) : ''

  if (inputActions === undefined) return null

  return (
    <>
      <button
        title="选择文件"
        aria-label="选择文件"
        onClick={() => setOpen(true)}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#888', padding: 4 }}
      >
        📎
      </button>
      {open && (
        <FilePickerDialog
          onClose={() => setOpen(false)}
          onPick={(paths) => {
            inputActions.setDraft(buildPathInjection(paths, draft))
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
