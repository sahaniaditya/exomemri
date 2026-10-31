import type { SlashItem } from './types'

/** Lower rank = better match. `null` = no match. */
function rankItem(item: SlashItem, query: string): number | null {
  const title = item.title.toLowerCase()
  if (title.startsWith(query)) return 0
  if (title.split(/\s+/).some(word => word.startsWith(query))) return 1
  const keywords = item.keywords.map(keyword => keyword.toLowerCase())
  if (keywords.some(keyword => keyword.startsWith(query))) return 2
  if (title.includes(query)) return 3
  if (keywords.some(keyword => keyword.includes(query))) return 4
  return null
}

interface Ranked {
  item: SlashItem
  index: number
  rank: number
}

/**
 * Filters slash items by title and keywords. An empty query returns everything in the
 * original order; otherwise prefix matches come first, then substring matches, each
 * group keeping its original relative order.
 */
export function filterSlashItems(items: SlashItem[], query: string): SlashItem[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return items
  const ranked: Ranked[] = []
  items.forEach((item, index) => {
    const rank = rankItem(item, needle)
    if (rank !== null) ranked.push({ item, index, rank })
  })
  return ranked.sort((a, b) => a.rank - b.rank || a.index - b.index).map(entry => entry.item)
}
