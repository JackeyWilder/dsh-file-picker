/**
 * Attachment-card store: module-level, session-scoped-in-practice list of
 * staged files shared between the tool-row picker (adds) and the dock rail
 * (renders / removes / sends). Pure logic — no React, no DOM — so it is
 * directly unit-testable. The component subscribes through the
 * `useSyncExternalStore`-compatible `subscribe`/`getSnapshot` pair.
 *
 * Scope note: the dock slot mounts once per active session, so the single
 * list behaves per-session in the single-pane dsh layout. Cards survive a
 * session switch until cleared (send / remove / clear) — same model as the
 * lostpaidaxing reference implementation.
 */

export interface RailFile {
  readonly path: string
  readonly name: string
  readonly size?: number
}

let cards: RailFile[] = []
const listeners = new Set<() => void>()

function emit(): void {
  for (const fn of listeners) fn()
}

/** uSES subscribe side. Returns an unsubscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** uSES getSnapshot side. The returned reference is stable between mutations. */
export function getSnapshot(): readonly RailFile[] {
  return cards
}

/** Basename of a Windows or POSIX path (handles a trailing separator). */
export function baseNameOf(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '')
  const idx = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'))
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed
}

/**
 * Add files to the rail, deduplicating on absolute path. Empty selections are
 * a no-op. Returns the merged snapshot.
 */
export function addFiles(paths: readonly string[] | string): readonly RailFile[] {
  // A bare string (e.g. a single path from a stale bundle or a direct caller)
  // must not be iterated character-by-character into per-char cards.
  const list = typeof paths === 'string' ? [paths] : paths
  if (list.length === 0) return cards
  const merged = cards.slice()
  for (const path of list) {
    if (typeof path === 'string' && path !== '' && !merged.some((c) => c.path === path)) {
      merged.push({ path, name: baseNameOf(path) })
    }
  }
  if (merged.length !== cards.length) {
    cards = merged
    emit()
  }
  return cards
}

/** Remove one staged file by absolute path. Unknown paths are a no-op. */
export function removeFile(path: string): readonly RailFile[] {
  const next = cards.filter((c) => c.path !== path)
  if (next.length !== cards.length) {
    cards = next
    emit()
  }
  return cards
}

/** Drop every staged file (after a successful send). */
export function clear(): void {
  if (cards.length === 0) return
  cards = []
  emit()
}

/**
 * Move one staged card one step up (-1) or down (+1). Out-of-range moves and
 * unknown paths are silent no-ops. Order flows into the staged list, so the
 * injected file list follows the card order.
 */
export function moveCard(path: string, dir: -1 | 1): readonly RailFile[] {
  const idx = cards.findIndex((c) => c.path === path)
  if (idx < 0) return cards
  const target = idx + dir
  if (target < 0 || target >= cards.length) return cards
  const next = cards.slice()
  ;[next[idx], next[target]] = [next[target], next[idx]]
  cards = next
  emit()
  return cards
}

/** Move one staged card to the front of the rail. Unknown paths are a no-op. */
export function moveCardToTop(path: string): readonly RailFile[] {
  const idx = cards.findIndex((c) => c.path === path)
  if (idx <= 0) return cards
  const next = [cards[idx], ...cards.slice(0, idx), ...cards.slice(idx + 1)]
  cards = next
  emit()
  return cards
}
