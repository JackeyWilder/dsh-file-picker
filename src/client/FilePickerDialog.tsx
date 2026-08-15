import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FileEntry } from '../host/list.js'
import { listFiles } from './api.js'

export interface FilePickerDialogProps {
  initialPath?: string
  onPick: (paths: string[]) => void
  onClose: () => void
}

/** Simple file browser: directory navigation + multi-select + path input. */
export function FilePickerDialog({ initialPath, onPick, onClose }: FilePickerDialogProps) {
  const [cwd, setCwd] = useState(initialPath ?? '')
  const [parent, setParent] = useState<string | null>(null)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pathDraft, setPathDraft] = useState('')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  const load = useCallback(async (path: string | undefined) => {
    setLoading(true)
    setError(null)
    try {
      const result = await listFiles(path)
      setCwd(result.path)
      setParent(result.parent)
      setEntries(result.entries)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(initialPath) }, [load, initialPath])

  const openDirectory = useCallback((path: string) => {
    void load(path)
  }, [load])

  const toggle = useCallback((path: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path); else next.add(path)
      return next
    })
  }, [])

  const navigateTo = useCallback(() => {
    const trimmed = pathDraft.trim()
    if (trimmed !== '') void load(trimmed)
  }, [pathDraft, load])

  const selectedList = useMemo(
    () => entries.filter((e) => selected.has(e.path) && !e.isDirectory).map((e) => e.path),
    [entries, selected],
  )

  return (
    <div role="dialog" aria-label="选择文件" style={{
      position: 'fixed', inset: '20% 25%', zIndex: 1000, display: 'flex', flexDirection: 'column',
      background: '#1e1e1e', color: '#d4d4d4', border: '1px solid #444', borderRadius: 8, padding: 12, minWidth: 480,
    }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          value={pathDraft === '' ? cwd : pathDraft}
          onChange={(e) => setPathDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') navigateTo() }}
          style={{ flex: 1, background: '#2d2d2d', color: '#d4d4d4', border: '1px solid #555', borderRadius: 4, padding: '4px 8px' }}
        />
        {parent !== null && (
          <button onClick={() => openDirectory(parent)} style={btnStyle}>向上</button>
        )}
        <button onClick={navigateTo} style={btnStyle}>转到</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 240, border: '1px solid #333', borderRadius: 4, padding: 4 }}>
        {loading && <div style={{ padding: 8 }}>加载中…</div>}
        {error !== null && <div style={{ padding: 8, color: '#f48771' }}>{error}</div>}
        {!loading && entries.map((entry) => (
          <div
            key={entry.path}
            onClick={() => entry.isDirectory ? openDirectory(entry.path) : toggle(entry.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '3px 6px', cursor: 'pointer',
              background: selected.has(entry.path) ? '#094771' : 'transparent',
            }}
          >
            <span>{entry.isDirectory ? '📁' : '📄'}</span>
            <span style={{ flex: 1 }}>{entry.name}</span>
            {!entry.isDirectory && <span style={{ color: '#888', fontSize: 12 }}>{entry.size} B</span>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#aaa' }}>已选 {selectedList.length} 个文件</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={btnStyle}>取消</button>
          <button
            onClick={() => onPick(selectedList)}
            disabled={selectedList.length === 0}
            style={{ ...btnStyle, background: selectedList.length === 0 ? '#333' : '#0e639c' }}
          >
            打开
          </button>
        </div>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  background: '#0e639c', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
}
