import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_RECENT, loadExpanded, loadRecent, recordRecent, saveExpanded } from './storage'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('expanded state', () => {
  it('round-trips per space', () => {
    saveExpanded('s1', new Set(['a', 'b']))
    saveExpanded('s2', new Set(['z']))
    expect([...loadExpanded('s1')].sort()).toEqual(['a', 'b'])
    expect([...loadExpanded('s2')]).toEqual(['z'])
    expect(loadExpanded('other').size).toBe(0)
  })

  it('ignores corrupt or wrongly shaped data', () => {
    window.localStorage.setItem('atlas.notes.expanded.s1', '{not json')
    expect(loadExpanded('s1').size).toBe(0)
    window.localStorage.setItem('atlas.notes.expanded.s1', '{"a":1}')
    expect(loadExpanded('s1').size).toBe(0)
    window.localStorage.setItem('atlas.notes.expanded.s1', '["ok", 3, null]')
    expect([...loadExpanded('s1')]).toEqual(['ok'])
  })

  it('does not throw when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(loadExpanded('s1').size).toBe(0)
    expect(() => saveExpanded('s1', new Set(['a']))).not.toThrow()
    expect(loadRecent('s1')).toEqual([])
    expect(() => recordRecent('s1', { id: 'a', title: 'A', icon: null })).not.toThrow()
  })
})

describe('recent pages', () => {
  it('puts the latest first, dedupes and caps', () => {
    for (let i = 0; i < MAX_RECENT + 3; i++) {
      recordRecent('s1', { id: `p${i}`, title: `P${i}`, icon: null })
    }
    recordRecent('s1', { id: 'p5', title: 'Renamed', icon: '📘' })
    const recent = loadRecent('s1')
    expect(recent).toHaveLength(MAX_RECENT)
    expect(recent[0]).toEqual({ id: 'p5', title: 'Renamed', icon: '📘' })
    expect(recent.filter(r => r.id === 'p5')).toHaveLength(1)
  })

  it('drops malformed entries', () => {
    window.localStorage.setItem(
      'atlas.notes.recent.s1',
      JSON.stringify([{ id: 'a', title: 'A', icon: null }, { id: 1 }, null, 'x'])
    )
    expect(loadRecent('s1')).toEqual([{ id: 'a', title: 'A', icon: null }])
  })
})
