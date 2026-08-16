import { useState, useSyncExternalStore } from 'react'
import { injectFiles } from './api.js'
import { clear, getSnapshot, removeFile, subscribe, type RailFile } from './rail.js'

// ── inline styling (cards + send row), themed with dsw-alias CSS variables ──
const CSS = [
  '.dshfp-rail{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px;width:100%;max-width:var(--dsh-composer-card-max-width,960px);margin:0 auto;padding:0 var(--dsh-composer-side-clearance,16px) 6px;box-sizing:border-box}',
  '.dshfp-card{display:inline-flex;align-items:center;gap:8px;max-width:280px;background:var(--dsw-alias-bg-tertiary,rgba(127,127,127,.14));border:1px solid var(--dsw-alias-border,rgba(127,127,127,.28));border-radius:10px;padding:6px 6px 6px 10px}',
  '.dshfp-card-icon{font-size:18px;line-height:1;flex:none}',
  '.dshfp-card-body{display:flex;flex-direction:column;min-width:0;gap:1px}',
  '.dshfp-card-name{font-size:13px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:190px}',
  '.dshfp-card-meta{font-size:11px;line-height:15px;color:var(--dsw-alias-fg-muted,rgba(160,160,160,.9));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:190px}',
  '.dshfp-card-x{border:none;background:transparent;color:inherit;cursor:pointer;font-size:16px;line-height:1;padding:3px 6px;border-radius:6px;opacity:.65;flex:none}',
  '.dshfp-card-x:hover{background:var(--dsw-alias-bg-hover,rgba(127,127,127,.22));opacity:1}',
  '.dshfp-rail-foot{margin-left:auto;display:inline-flex;align-items:center;gap:8px}',
  '.dshfp-err{color:var(--dsw-alias-state-error-primary,#f87171);font-size:12px;line-height:16px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dshfp-send{display:inline-flex;align-items:center;border:1px solid var(--dsw-alias-border,rgba(127,127,127,.32));background:transparent;color:var(--dsw-alias-fg-primary,inherit);border-radius:8px;padding:4px 14px;font-size:13px;line-height:20px;cursor:pointer}',
  '.dshfp-send:hover:not(:disabled){background:var(--dsw-alias-bg-hover,rgba(127,127,127,.14))}',
  '.dshfp-send:disabled{opacity:.55;cursor:default}',
  '.dshfp-send:focus-visible{outline:2px solid var(--dsw-alias-fg-primary,#3b82f6);outline-offset:2px}',
].join('\n')
const TAG_ID = 'dsh-file-picker/style-rail'
if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css="${TAG_ID}"]`) === null) {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-file-picker'
  tag.dataset.pluginCss = TAG_ID
  tag.textContent = CSS
  document.head.appendChild(tag)
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'])
const ARCHIVE_EXT = new Set(['zip', 'rar', '7z', 'tar', 'gz'])

/** Card icon: folder for trailing-separator paths, extension map otherwise. */
function iconFor(path: string): string {
  if (/[\\/]$/.test(path)) return '📁'
  const ext = (String(path || '').split('.').pop() || '').toLowerCase()
  if (IMAGE_EXT.has(ext)) return '🖼️'
  if (ext === 'pdf') return '📕'
  if (ARCHIVE_EXT.has(ext)) return '🗜️'
  return '📄'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Meta line: size when known (picker returns paths only today), else directory. */
function metaOf(file: RailFile): string {
  if (typeof file.size === 'number' && Number.isFinite(file.size)) return formatSize(file.size)
  const idx = Math.max(file.path.lastIndexOf('\\'), file.path.lastIndexOf('/'))
  return idx > 0 ? file.path.slice(0, idx) : file.path
}

export interface AttachmentRailProps {
  /** Framework-provided session id (session-scope dock slot). */
  sessionId?: string
  /** Public input action face; submit() fires the composer's send machine. */
  inputActions?: { submit(): void }
  /** Selector hook over the live input state (draft text). */
  useInput?: { (selector: (s: { draft: string }) => string): string }
}

/**
 * Attachment cards above the composer (`conversation.input.dock`). Renders
 * the staged files and a send button that pushes them into the session as an
 * injected context message before submitting the current draft.
 */
export function AttachmentRail({ sessionId, inputActions, useInput }: AttachmentRailProps) {
  const files = useSyncExternalStore(subscribe, getSnapshot)
  const draft = useInput ? useInput((s) => s.draft) : ''
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (files.length === 0) return null

  const onSend = async () => {
    if (sending) return
    if (sessionId === undefined) return
    setSending(true)
    setError(null)
    try {
      await injectFiles(sessionId, files.map((f) => f.path))
      inputActions?.submit()
      clear()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSending(false)
    }
  }

  // An empty-draft submit is a no-op in the input machine, so the rail's send
  // stays disabled until the user types something to send alongside the files.
  const canSend = !sending && draft.trim() !== '' && sessionId !== undefined

  return (
    <div className="dshfp-rail">
      {files.map((file) => (
        <div key={file.path} className="dshfp-card" title={file.path}>
          <span className="dshfp-card-icon" aria-hidden="true">{iconFor(file.path)}</span>
          <span className="dshfp-card-body">
            <span className="dshfp-card-name">{file.name}</span>
            <span className="dshfp-card-meta">{metaOf(file)}</span>
          </span>
          <button
            type="button"
            className="dshfp-card-x"
            aria-label={`移除 ${file.name}`}
            onClick={() => removeFile(file.path)}
          >
            ×
          </button>
        </div>
      ))}
      <div className="dshfp-rail-foot">
        {error ? <span className="dshfp-err" role="status" title={error}>{error}</span> : null}
        <button
          type="button"
          className="dshfp-send"
          onClick={() => void onSend()}
          disabled={!canSend}
          title={canSend ? '发送消息并注入所选文件' : '先输入消息内容再发送'}
        >
          {sending ? '发送中…' : '发送'}
        </button>
      </div>
    </div>
  )
}
