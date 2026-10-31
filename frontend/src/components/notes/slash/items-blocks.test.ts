import { afterEach, describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import { createEditor, doc, getDoc, p } from '@/test/noteEditor'
import { blockSlashItems } from './items-blocks'
import { blockSlashItems as reExported } from '../extensions/blocks'

let editor: Editor
afterEach(() => editor?.destroy())

/** Editor containing "intro" and a paragraph "/query" with the caret at its end; returns the slash range. */
function setup(query = '/x') {
  editor = createEditor(doc(p('intro'), p(query)))
  const end = editor.state.doc.content.size - 1
  const range = { from: end - query.length, to: end }
  editor.commands.setTextSelection(end)
  return range
}

const item = (id: string) => blockSlashItems.find((i) => i.id === id)!

describe('blockSlashItems', () => {
  it('is re-exported from blocks.ts and has unique ids in the Blocks group', () => {
    expect(reExported).toBe(blockSlashItems)
    const ids = blockSlashItems.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([
      'taskList',
      'table',
      'callout',
      'callout-success',
      'callout-warning',
      'callout-danger',
      'toggle',
    ])
    for (const i of blockSlashItems) {
      expect(i.group).toBe('Blocks')
      expect(i.title).toBeTruthy()
      expect(i.keywords.length).toBeGreaterThan(0)
      expect(i.icon).toBeTruthy()
    }
  })

  it('Task list replaces the slash text with an unchecked task item', () => {
    const range = setup()
    item('taskList').run({ editor, range })
    const blocks = getDoc(editor).content!
    expect(blocks[0]).toEqual(p('intro'))
    expect(blocks[1]).toEqual({
      type: 'taskList',
      content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }],
    })
  })

  it('Table inserts a 3x3 table with a header row and removes the slash text', () => {
    const range = setup()
    item('table').run({ editor, range })
    const blocks = getDoc(editor).content!
    const table = blocks.find((b) => b.type === 'table')!
    expect(table.content).toHaveLength(3)
    expect(table.content!.map((r) => r.content!.length)).toEqual([3, 3, 3])
    expect(table.content![0].content!.every((c) => c.type === 'tableHeader')).toBe(true)
    expect(editor.state.doc.textContent).toBe('intro')
  })

  it.each([
    ['callout', 'info', '\u{1F4A1}'],
    ['callout-success', 'success', '✅'],
    ['callout-warning', 'warning', '⚠️'],
    ['callout-danger', 'danger', '\u{1F6AB}'],
  ])('%s inserts a %s callout with its emoji', (id, variant, emoji) => {
    const range = setup()
    item(id).run({ editor, range })
    const blocks = getDoc(editor).content!
    expect(blocks[1]).toEqual({
      type: 'callout',
      attrs: { emoji, variant },
      content: [{ type: 'paragraph' }],
    })
    expect(editor.state.doc.textContent).toBe('intro')
    // The caret lands inside the new callout so the user can type straight away.
    expect(editor.state.selection.$from.node(-1).type.name).toBe('callout')
  })

  it('Toggle inserts an open toggle with a summary and one body line', () => {
    const range = setup()
    item('toggle').run({ editor, range })
    expect(getDoc(editor).content![1]).toEqual({
      type: 'toggle',
      attrs: { open: true },
      content: [{ type: 'toggleSummary' }, { type: 'paragraph' }],
    })
    expect(editor.state.doc.textContent).toBe('intro')
  })

  it('works when the slash query is longer (e.g. "/callout")', () => {
    const range = setup('/callout')
    item('callout').run({ editor, range })
    expect(editor.state.doc.textContent).toBe('intro')
    expect(getDoc(editor).content![1].type).toBe('callout')
  })

  it('every item yields a schema-valid document', () => {
    for (const i of blockSlashItems) {
      const range = setup()
      i.run({ editor, range })
      expect(() => editor.state.doc.check()).not.toThrow()
      editor.destroy()
    }
  })
})
