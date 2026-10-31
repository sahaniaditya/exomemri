import { describe, expect, it } from 'vitest'
import type { JSONContent } from '@tiptap/core'
import {
  deleteBlock,
  dropSlotForY,
  duplicateBlock,
  moveBlock,
  slotToTargetIndex,
  turnInto,
  TURN_INTO_TARGETS,
} from './blockOps'

const p = (text: string): JSONContent => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })
const texts = (d: JSONContent) => (d.content ?? []).map((b) => b.content?.[0]?.text)

describe('moveBlock', () => {
  const d = doc(p('a'), p('b'), p('c'), p('d'))
  it.each([
    [0, 3, ['b', 'c', 'd', 'a']],
    [3, 0, ['d', 'a', 'b', 'c']],
    [1, 2, ['a', 'c', 'b', 'd']],
    [2, 1, ['a', 'c', 'b', 'd']],
    [0, 1, ['b', 'a', 'c', 'd']],
  ])('moves %i -> %i', (from, to, expected) => {
    expect(texts(moveBlock(d, from, to))).toEqual(expected)
  })

  it.each([
    [-1, 2],
    [0, 4],
    [4, 0],
    [1.5, 2],
    [Number.NaN, 0],
  ])('returns the same doc for out-of-range %s -> %s', (from, to) => {
    expect(moveBlock(d, from, to)).toBe(d)
  })

  it('is a no-op when from equals to', () => {
    expect(moveBlock(d, 2, 2)).toBe(d)
  })

  it('does not mutate the input and preserves nested content', () => {
    const nested = doc(
      { type: 'bulletList', content: [{ type: 'listItem', content: [p('x'), { type: 'bulletList', content: [{ type: 'listItem', content: [p('y')] }] }] }] },
      p('after'),
    )
    const snapshot = structuredClone(nested)
    const moved = moveBlock(nested, 0, 1)
    expect(nested).toEqual(snapshot)
    expect(moved.content![1]).toEqual(snapshot.content![0])
    expect(moved.content![1]).not.toBe(nested.content![0])
  })

  it('handles an empty document', () => {
    expect(moveBlock({ type: 'doc' }, 0, 1)).toEqual({ type: 'doc' })
  })
})

describe('duplicateBlock', () => {
  const d = doc(p('a'), p('b'))
  it('inserts a deep copy right after the block', () => {
    const out = duplicateBlock(d, 0)
    expect(texts(out)).toEqual(['a', 'a', 'b'])
    expect(out.content![0]).not.toBe(out.content![1])
  })
  it('duplicates the last block', () => {
    expect(texts(duplicateBlock(d, 1))).toEqual(['a', 'b', 'b'])
  })
  it('copies nested content', () => {
    const table = { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [p('c')] }] }] }
    const out = duplicateBlock(doc(table), 0)
    expect(out.content).toEqual([table, table])
  })
  it.each([-1, 2, 99, 0.5])('returns the same doc for index %s', (i) => {
    expect(duplicateBlock(d, i)).toBe(d)
  })
})

describe('deleteBlock', () => {
  it('removes a block', () => {
    expect(texts(deleteBlock(doc(p('a'), p('b')), 0))).toEqual(['b'])
  })
  it('keeps an empty paragraph when the last block is removed', () => {
    expect(deleteBlock(doc(p('a')), 0).content).toEqual([{ type: 'paragraph' }])
  })
  it('returns the same doc when out of range', () => {
    const d = doc(p('a'))
    expect(deleteBlock(d, 3)).toBe(d)
  })
})

describe('turnInto', () => {
  const heading = (level: number, text: string): JSONContent => ({
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  })
  const bold: JSONContent = {
    type: 'paragraph',
    content: [{ type: 'text', text: 'hi', marks: [{ type: 'bold' }] }],
  }
  const bullets: JSONContent = {
    type: 'bulletList',
    content: [
      { type: 'listItem', content: [p('one'), { type: 'bulletList', content: [{ type: 'listItem', content: [p('nested')] }] }] },
      { type: 'listItem', content: [p('two')] },
    ],
  }

  it('paragraph -> heading keeps marks', () => {
    expect(turnInto(bold, 'heading2')).toEqual([
      { type: 'heading', attrs: { level: 2 }, content: bold.content },
    ])
  })

  it('heading -> paragraph', () => {
    expect(turnInto(heading(1, 'T'), 'paragraph')).toEqual([p('T')])
  })

  it('heading level change and same-level no-op', () => {
    expect(turnInto(heading(1, 'T'), 'heading3')[0].attrs).toEqual({ level: 3 })
    expect(turnInto(heading(2, 'T'), 'heading2')).toEqual([heading(2, 'T')])
  })

  it('same type is returned unchanged (as a copy)', () => {
    const out = turnInto(bullets, 'bulletList')
    expect(out).toEqual([bullets])
    expect(out[0]).not.toBe(bullets)
  })

  it('paragraph -> blockquote / callout / toggle / code / lists', () => {
    expect(turnInto(p('x'), 'blockquote')).toEqual([{ type: 'blockquote', content: [p('x')] }])
    expect(turnInto(p('x'), 'callout')).toEqual([
      { type: 'callout', attrs: { emoji: '💡', variant: 'info' }, content: [p('x')] },
    ])
    expect(turnInto(p('x'), 'toggle')).toEqual([
      {
        type: 'toggle',
        attrs: { open: true },
        content: [{ type: 'toggleSummary', content: [{ type: 'text', text: 'x' }] }],
      },
    ])
    expect(turnInto(p('x'), 'codeBlock')).toEqual([
      { type: 'codeBlock', content: [{ type: 'text', text: 'x' }] },
    ])
    expect(turnInto(p('x'), 'taskList')).toEqual([
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [p('x')] }] },
    ])
    expect(turnInto(p('x'), 'orderedList')).toEqual([
      { type: 'orderedList', content: [{ type: 'listItem', content: [p('x')] }] },
    ])
  })

  it('empty paragraph converts without empty text nodes', () => {
    expect(turnInto({ type: 'paragraph' }, 'heading1')).toEqual([
      { type: 'heading', attrs: { level: 1 } },
    ])
    expect(turnInto({ type: 'paragraph' }, 'codeBlock')).toEqual([{ type: 'codeBlock' }])
  })

  it('bullet -> ordered/task keeps item structure and nesting', () => {
    const ordered = turnInto(bullets, 'orderedList')[0]
    expect(ordered.type).toBe('orderedList')
    expect(ordered.content![0].content![1].type).toBe('orderedList')
    expect(ordered.content![0].content![1].content![0].content).toEqual([p('nested')])
    const task = turnInto(bullets, 'taskList')[0]
    expect(task.content![0]).toMatchObject({ type: 'taskItem', attrs: { checked: false } })
    expect(task.content![0].content![1].content![0].type).toBe('taskItem')
  })

  it('list -> paragraphs flattens every item including nested ones', () => {
    expect(turnInto(bullets, 'paragraph')).toEqual([p('one'), p('nested'), p('two')])
  })

  it('callout -> blockquote preserves children; blockquote -> callout too', () => {
    const callout: JSONContent = {
      type: 'callout',
      attrs: { emoji: '⚠️', variant: 'warning' },
      content: [p('a'), p('b')],
    }
    const quote = turnInto(callout, 'blockquote')
    expect(quote).toEqual([{ type: 'blockquote', content: [p('a'), p('b')] }])
    expect(turnInto(quote[0], 'callout')[0].content).toEqual([p('a'), p('b')])
  })

  it('toggle -> paragraph keeps summary then body; callout -> toggle splits first line', () => {
    const toggle: JSONContent = {
      type: 'toggle',
      attrs: { open: false },
      content: [{ type: 'toggleSummary', content: [{ type: 'text', text: 'S' }] }, p('body')],
    }
    expect(turnInto(toggle, 'paragraph')).toEqual([p('S'), p('body')])
    const t = turnInto({ type: 'callout', attrs: {}, content: [p('first'), p('rest')] }, 'toggle')[0]
    expect(t.content).toEqual([
      { type: 'toggleSummary', content: [{ type: 'text', text: 'first' }] },
      p('rest'),
    ])
  })

  it('code block text survives, marks are dropped', () => {
    expect(turnInto(bold, 'codeBlock')[0].content).toEqual([{ type: 'text', text: 'hi' }])
    expect(turnInto({ type: 'codeBlock', content: [{ type: 'text', text: 'a\nb' }] }, 'paragraph')).toEqual([p('a\nb')])
  })

  it.each(['image', 'table', 'horizontalRule'])('leaves %s untouched', (type) => {
    const node: JSONContent = { type, attrs: { key: 'k' } }
    for (const target of TURN_INTO_TARGETS) expect(turnInto(node, target)).toEqual([node])
  })
})

describe('drop slots', () => {
  const rects = [
    { top: 0, bottom: 20 },
    { top: 20, bottom: 60 },
    { top: 60, bottom: 80 },
  ]
  it.each([
    [-5, 0],
    [9, 0],
    [11, 1],
    [39, 1],
    [41, 2],
    [69, 2],
    [71, 3],
    [500, 3],
  ])('y=%i -> slot %i', (y, slot) => {
    expect(dropSlotForY(rects, y)).toBe(slot)
  })
  it('empty list -> slot 0', () => {
    expect(dropSlotForY([], 10)).toBe(0)
  })
  it.each([
    [1, 0, 0],
    [1, 1, 1],
    [1, 2, 1],
    [1, 3, 2],
    [0, 3, 2],
  ])('from %i slot %i -> target %i', (from, slot, target) => {
    expect(slotToTargetIndex(from, slot)).toBe(target)
  })
})
