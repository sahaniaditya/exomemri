import { describe, expect, it } from 'vitest'
import {
  applyReorder,
  buildTree,
  canMove,
  computeReorder,
  dropPosition,
  moveTargets,
} from './tree'
import type { NoteTreeItem } from './types'

const item = (id: string, order: number, parent: string | null = null, title = id): NoteTreeItem => ({
  id,
  title,
  icon: null,
  parent_id: parent,
  sort_order: order,
  updated_at: null,
})

// A(0){A1(0),A2(1)}  B(1)  C(2){C1(0)}  D(3)
const ITEMS = [
  item('D', 3),
  item('A2', 1, 'A'),
  item('A', 0),
  item('C1', 0, 'C'),
  item('B', 1),
  item('A1', 0, 'A'),
  item('C', 2),
]
const tree = () => buildTree(ITEMS)

describe('buildTree', () => {
  it('nests children under roots and sorts by sort_order', () => {
    const t = tree()
    expect(t.map(r => r.id)).toEqual(['A', 'B', 'C', 'D'])
    expect(t[0].children.map(c => c.id)).toEqual(['A1', 'A2'])
    expect(t[1].children).toEqual([])
    expect(t[2].children.map(c => c.id)).toEqual(['C1'])
  })

  it('breaks sort_order ties by title', () => {
    const t = buildTree([item('x', 0, null, 'Zed'), item('y', 0, null, 'Alpha')])
    expect(t.map(r => r.id)).toEqual(['y', 'x'])
  })

  it('promotes orphans (missing parent) to roots', () => {
    const t = buildTree([item('A', 0), item('lost', 1, 'gone')])
    expect(t.map(r => r.id)).toEqual(['A', 'lost'])
    expect(t[1].parent_id).toBeNull()
  })

  it('handles an empty list', () => {
    expect(buildTree([])).toEqual([])
  })
})

describe('canMove', () => {
  const cases: [string, string, string | null, boolean][] = [
    ['root to top level', 'B', null, true],
    ['child to top level', 'A1', null, true],
    ['root without children under another root', 'B', 'A', true],
    ['child under a different root', 'A1', 'B', true],
    ['child under its own parent', 'A1', 'A', true],
    ['root with children under another root', 'A', 'B', false],
    ['onto itself', 'B', 'B', false],
    ['under a child (depth limit)', 'B', 'A1', false],
    ['unknown page', 'nope', 'A', false],
    ['unknown parent', 'B', 'nope', false],
    ['unknown page to top level', 'nope', null, false],
  ]
  it.each(cases)('%s', (_name, id, parent, expected) => {
    expect(canMove(tree(), id, parent)).toBe(expected)
  })
})

describe('moveTargets', () => {
  it('lists roots a childless page can join, excluding itself', () => {
    expect(moveTargets(tree(), 'B').map(r => r.id)).toEqual(['A', 'C', 'D'])
  })
  it('is empty for a page that has children', () => {
    expect(moveTargets(tree(), 'A')).toEqual([])
  })
})

describe('dropPosition', () => {
  it.each([
    [0.1, true, 'before'],
    [0.5, true, 'inside'],
    [0.9, true, 'after'],
    [0.25, true, 'inside'],
    [0.75, true, 'inside'],
    [0.2, false, 'before'],
    [0.5, false, 'after'],
    [0.8, false, 'after'],
  ] as const)('ratio %s allowInside=%s -> %s', (ratio, inside, expected) => {
    expect(dropPosition(ratio, inside)).toBe(expected)
  })
})

describe('computeReorder', () => {
  it('reorders roots (dragged page first)', () => {
    // D before B: A D B C
    expect(computeReorder(tree(), 'D', 'B', 'before')).toEqual([
      { id: 'D', parent_id: null, sort_order: 1 },
      { id: 'B', parent_id: null, sort_order: 2 },
      { id: 'C', parent_id: null, sort_order: 3 },
    ])
  })

  it('reorders within a parent', () => {
    expect(computeReorder(tree(), 'A2', 'A1', 'before')).toEqual([
      { id: 'A2', parent_id: 'A', sort_order: 0 },
      { id: 'A1', parent_id: 'A', sort_order: 1 },
    ])
  })

  it('moves a child to another parent at a position', () => {
    // A1 before C1: C children -> A1, C1
    expect(computeReorder(tree(), 'A1', 'C1', 'before')).toEqual([
      { id: 'A1', parent_id: 'C', sort_order: 0 },
      { id: 'C1', parent_id: 'C', sort_order: 1 },
    ])
  })

  it('drops inside a root: appended as the last child', () => {
    expect(computeReorder(tree(), 'B', 'C', 'inside')).toEqual([
      { id: 'B', parent_id: 'C', sort_order: 1 },
    ])
  })

  it('promotes a child to the top level next to a root', () => {
    // A1 after B: A B A1 C D
    expect(computeReorder(tree(), 'A1', 'B', 'after')).toEqual([
      { id: 'A1', parent_id: null, sort_order: 2 },
      { id: 'C', parent_id: null, sort_order: 3 },
      { id: 'D', parent_id: null, sort_order: 4 },
    ])
  })

  it('returns [] when nothing would change', () => {
    expect(computeReorder(tree(), 'B', 'A', 'after')).toEqual([])
    expect(computeReorder(tree(), 'A2', 'A1', 'after')).toEqual([])
  })

  it.each([
    ['onto itself', 'B', 'B', 'inside'],
    ['a page with children inside another root', 'A', 'B', 'inside'],
    ['inside a child (depth)', 'B', 'A1', 'inside'],
    ['unknown drag', 'zzz', 'B', 'before'],
    ['unknown target', 'B', 'zzz', 'before'],
  ] as const)('rejects %s', (_n, drag, target, pos) => {
    expect(computeReorder(tree(), drag, target, pos)).toBeNull()
  })

  it('lets a root with children move among roots', () => {
    expect(computeReorder(tree(), 'A', 'D', 'after')).toEqual([
      { id: 'A', parent_id: null, sort_order: 3 },
      { id: 'B', parent_id: null, sort_order: 0 },
      { id: 'C', parent_id: null, sort_order: 1 },
      { id: 'D', parent_id: null, sort_order: 2 },
    ])
  })

  it('refuses to nest a root that has children via before/after a child', () => {
    expect(computeReorder(tree(), 'A', 'C1', 'before')).toBeNull()
  })
})

describe('applyReorder', () => {
  it('applies parent and sort changes to a flat list', () => {
    const updates = computeReorder(tree(), 'B', 'C', 'inside')!
    const next = applyReorder(ITEMS, updates)
    expect(next.find(i => i.id === 'B')).toMatchObject({ parent_id: 'C', sort_order: 1 })
    expect(buildTree(next).find(r => r.id === 'C')!.children.map(c => c.id)).toEqual(['C1', 'B'])
    expect(next.find(i => i.id === 'D')).toEqual(ITEMS.find(i => i.id === 'D'))
  })
})
