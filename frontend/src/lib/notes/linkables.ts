/**
 * What a note can link to: this space's captures and pages. Pure helpers plus
 * a small cached loader that goes through the BFF.
 */
import { fetchTree } from './client'

export interface LinkableItem {
  kind: 'source' | 'note'
  id: string
  title: string
  /** Capture type (youtube, article, …) for sources; page icon for notes. */
  detail: string | null
}

export const MAX_MENTION_RESULTS = 8
const CACHE_TTL_MS = 30_000

export function getSpaceIdFromPath(pathname: string): string | null {
  return /\/spaces\/([^/]+)/.exec(pathname)?.[1] ?? null
}

export function getNoteIdFromPath(pathname: string): string | null {
  return /\/notes\/([^/]+)/.exec(pathname)?.[1] ?? null
}

/** Case-insensitive title filter; prefix matches rank first. */
export function filterLinkables(
  items: LinkableItem[],
  query: string,
  limit = MAX_MENTION_RESULTS
): LinkableItem[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return items.slice(0, limit)
  const starts: LinkableItem[] = []
  const contains: LinkableItem[] = []
  for (const item of items) {
    const title = item.title.toLowerCase()
    if (title.startsWith(needle)) starts.push(item)
    else if (title.includes(needle)) contains.push(item)
  }
  return [...starts, ...contains].slice(0, limit)
}

interface SourceRow {
  id: string
  title: string
  type: string
}

async function fetchSources(spaceId: string): Promise<LinkableItem[]> {
  const res = await fetch(`/api/spaces/${spaceId}/sources`)
  if (!res.ok) throw new Error(`sources ${res.status}`)
  const data = (await res.json()) as { sources?: SourceRow[] }
  return (data.sources ?? []).map(s => ({
    kind: 'source' as const,
    id: s.id,
    title: s.title || 'Untitled capture',
    detail: s.type,
  }))
}

const cache = new Map<string, { at: number; items: LinkableItem[] }>()

/** Captures then pages for a space; cached briefly so typing `@` stays snappy. */
export async function loadLinkables(spaceId: string, excludeNoteId?: string | null) {
  const hit = cache.get(spaceId)
  let items: LinkableItem[]
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    items = hit.items
  } else {
    const [sources, notes] = await Promise.all([fetchSources(spaceId), fetchTree(spaceId)])
    items = [
      ...sources,
      ...notes.map(n => ({
        kind: 'note' as const,
        id: n.id,
        title: n.title,
        detail: n.icon,
      })),
    ]
    cache.set(spaceId, { at: Date.now(), items })
  }
  return excludeNoteId ? items.filter(i => !(i.kind === 'note' && i.id === excludeNoteId)) : items
}

export function clearLinkablesCache(): void {
  cache.clear()
}
