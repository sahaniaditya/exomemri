/**
 * Small per-space localStorage helpers (expanded tree nodes, recent pages).
 * Every access is guarded: storage can be blocked, full or absent (SSR).
 */

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Persistence is a convenience; ignore quota / privacy-mode failures.
  }
}

const expandedKey = (spaceId: string) => `atlas.notes.expanded.${spaceId}`
const recentKey = (spaceId: string) => `atlas.notes.recent.${spaceId}`
export const MAX_RECENT = 8

export function loadExpanded(spaceId: string): Set<string> {
  const stored = read<unknown>(expandedKey(spaceId), [])
  return new Set(Array.isArray(stored) ? stored.filter(v => typeof v === 'string') : [])
}

export function saveExpanded(spaceId: string, expanded: Set<string>): void {
  write(expandedKey(spaceId), [...expanded])
}

export interface RecentPage {
  id: string
  title: string
  icon: string | null
}

export function loadRecent(spaceId: string): RecentPage[] {
  const stored = read<unknown>(recentKey(spaceId), [])
  if (!Array.isArray(stored)) return []
  return stored
    .filter((v): v is RecentPage => !!v && typeof v.id === 'string' && typeof v.title === 'string')
    .slice(0, MAX_RECENT)
}

/** Move `page` to the front of the recent list (deduped, capped). */
export function recordRecent(spaceId: string, page: RecentPage): RecentPage[] {
  const next = [page, ...loadRecent(spaceId).filter(p => p.id !== page.id)].slice(0, MAX_RECENT)
  write(recentKey(spaceId), next)
  return next
}
