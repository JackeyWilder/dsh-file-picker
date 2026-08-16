import { useEffect, useRef, useSyncExternalStore } from 'react'
import { revealPath, stageFiles, unstageFiles } from './api.js'
import { clear, getSnapshot, removeFile, subscribe, type RailFile } from './rail.js'

// ── inline styling (cards only; sending rides the main composer submit) ──
const CSS = [
  '.dshfp-rail{display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:100%;max-width:var(--dsh-composer-card-max-width,960px);margin:0 auto;padding:0 var(--dsh-composer-side-clearance,16px) 6px;box-sizing:border-box}',
  '.dshfp-card{display:inline-flex;align-items:center;gap:8px;max-width:280px;background:var(--dsw-alias-bg-tertiary,rgba(127,127,127,.14));border:1px solid var(--dsw-alias-border,rgba(127,127,127,.28));border-radius:10px;padding:6px 6px 6px 10px}',
  '.dshfp-card-icon{font-size:18px;line-height:1;flex:none}',
  '.dshfp-card-body{display:flex;flex-direction:column;min-width:0;gap:1px}',
  '.dshfp-card-name{font-size:13px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px}',
  '.dshfp-card-meta{font-size:11px;line-height:15px;color:var(--dsw-alias-fg-muted,rgba(160,160,160,.9));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px}',
  '.dshfp-card-ops{display:flex;align-items:center;gap:2px;flex:none}',
  '.dshfp-card-ops button{border:none;background:transparent;color:inherit;cursor:pointer;font-size:13px;line-height:1;padding:3px 4px;border-radius:6px;opacity:.65;flex:none}',
  '.dshfp-card-ops button:hover{background:var(--dsw-alias-bg-hover,rgba(127,127,127,.22));opacity:1}',
  '.dshfp-clear{border:1px solid var(--dsw-alias-border,rgba(127,127,127,.28));background:transparent;color:var(--dsw-alias-fg-muted,rgba(160,160,160,.9));cursor:pointer;font-size:12px;line-height:1;padding:4px 8px;border-radius:6px;margin-left:4px}',
  '.dshfp-clear:hover{background:var(--dsw-alias-bg-hover,rgba(127,127,127,.22));opacity:1}',
  '.dshfp-hint{font-size:12px;line-height:16px;color:var(--dsw-alias-fg-muted,rgba(160,160,160,.9))}',
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
  /** Selector hook over the live conversation snapshot (framework standard kit). */
  useSession?: { (selector: (s: { nodes: readonly unknown[] }) => number): number }
}

/**
 * Attachment cards above the composer (`conversation.input.dock`). The staged
 * paths ride the NEXT user message: the rail mirrors its cards onto the host
 * (`/stage`), and the host injects them into the session when the message
 * enters the inbox. The rail clears itself once that message lands — observed
 * as a conversation-node count increase, which is the same signal on every
 * send path (typed prompt, slash command, steer, image-only).
 */
export function AttachmentRail({ sessionId, useSession }: AttachmentRailProps) {
  const files = useSyncExternalStore(subscribe, getSnapshot)
  const messageCount = useSession ? useSession((s) => s.nodes.length) : 0
  const lastSeenCount = useRef(0)

  // Mirror the rail onto the host: replace the staged list with exactly the
  // current cards, or drop it entirely when the rail is empty (a removal or
  // a no-send clear must not leave stale paths staged).
  useEffect(() => {
    if (sessionId === undefined) return
    if (files.length === 0) {
      void unstageFiles(sessionId).catch((cause) => {
        console.error('[dsh-file-picker] unstage failed:', cause)
      })
      return
    }
    void stageFiles(sessionId, files.map((f) => f.path)).catch((cause) => {
      console.error('[dsh-file-picker] stage failed:', cause)
    })
  }, [sessionId, files])

  // Clear the cards once the user's send produced a new conversation node —
  // the host has injected the staged paths by then, so the cards have served
  // their purpose and must not ride a second message.
  useEffect(() => {
    if (messageCount <= lastSeenCount.current) return
    lastSeenCount.current = messageCount
    if (files.length > 0) clear()
  }, [files, messageCount])

  if (files.length === 0) return null

  const copyPath = (path: string): void => {
    void navigator.clipboard.writeText(path).catch((cause) => {
      console.error('[dsh-file-picker] copy failed:', cause)
    })
  }

  const clearAll = (): void => {
    clear()
  }

  return (
    <div className="dshfp-rail">
      {files.map((file) => (
        <div key={file.path} className="dshfp-card" title={file.path}>
          <span className="dshfp-card-icon" aria-hidden="true">{iconFor(file.path)}</span>
          <span className="dshfp-card-body">
            <span className="dshfp-card-name">{file.name}</span>
            <span className="dshfp-card-meta">{metaOf(file)}</span>
          </span>
          <span className="dshfp-card-ops">
            <button
              type="button"
              aria-label={`复制路径 ${file.name}`}
              title="复制路径"
              onClick={() => copyPath(file.path)}
            >
              📋
            </button>
            <button
              type="button"
              aria-label={`在资源管理器中定位 ${file.name}`}
              title="在资源管理器中定位"
              onClick={() => void revealPath(file.path)}
            >
              📂
            </button>
            <button
              type="button"
              className="dshfp-card-x"
              aria-label={`移除 ${file.name}`}
              onClick={() => removeFile(file.path)}
            >
              ×
            </button>
          </span>
        </div>
      ))}
      <span className="dshfp-hint">随下一条消息发送</span>
      <button type="button" className="dshfp-clear" onClick={clearAll}>清空</button>
    </div>
  )
}
