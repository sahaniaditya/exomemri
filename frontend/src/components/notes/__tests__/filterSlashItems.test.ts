import { describe, expect, it } from 'vitest'
import { filterSlashItems } from '../slash/filterSlashItems'
import { basicSlashItems } from '../slash/items-basic'
import type { SlashItem } from '../slash/types'

const item = (id: string, title: string, keywords: string[] = []): SlashItem => ({
  id,
  title,
  keywords,
  group: 'Basic',
  icon: 'x',
  run: () => {},
})

describe('filterSlashItems', () => {
  const items = [
    item('a', 'Numbered list', ['ol']),
    item('b', 'Bullet list', ['ul']),
    item('c', 'Listen', []),
    item('d', 'Quote', ['cite']),
  ]

  it('returns all items in order for an empty or blank query', () => {
    expect(filterSlashItems(items, '')).toEqual(items)
    expect(filterSlashItems(items, '   ')).toEqual(items)
  })

  it('ranks title-prefix matches before word-prefix matches', () => {
    // "list": prefix of "Listen" (c); word-prefix in "Numbered list" (a) and "Bullet list" (b).
    const ids = filterSlashItems(items, 'list').map(i => i.id)
    expect(ids).toEqual(['c', 'a', 'b'])
  })

  it('matches by keyword', () => {
    expect(filterSlashItems(items, 'cite').map(i => i.id)).toEqual(['d'])
    expect(filterSlashItems(items, 'ul').map(i => i.id)).toEqual(['b'])
  })

  it('prefers a keyword prefix over a title substring', () => {
    const list = [item('x', 'Rebucket', []), item('y', 'Gallery', ['buck'])]
    expect(filterSlashItems(list, 'buck').map(i => i.id)).toEqual(['y', 'x'])
  })

  it('is case-insensitive', () => {
    expect(filterSlashItems(items, 'QUO').map(i => i.id)).toEqual(['d'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterSlashItems(items, 'zzzz')).toEqual([])
  })

  it('finds the real basic items', () => {
    expect(filterSlashItems(basicSlashItems, 'h2')[0].id).toBe('heading-2')
    expect(filterSlashItems(basicSlashItems, 'img')[0].id).toBe('image')
  })
})
