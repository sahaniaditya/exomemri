import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import { allSlashItems, buildNoteExtensions } from '../extensions'

const scope = { kind: 'space' as const, spaceId: 's1' }
const editors: Editor[] = []

function makeEditor(content: Record<string, unknown>): Editor {
  const editor = new Editor({ extensions: buildNoteExtensions(scope), content })
  editors.push(editor)
  return editor
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
  vi.restoreAllMocks()
})

const text = (value: string) => ({ type: 'text', text: value })
const para = (value: string) => ({ type: 'paragraph', content: [text(value)] })

/** One document using every node and mark in the shared document model (README contract). */
const FULL_DOC = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [text('Title')] },
    para('plain'),
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'marked', marks: [{ type: 'highlight', attrs: { color: '#fef08a' } }] },
        { type: 'text', text: ' colour', marks: [{ type: 'textStyle', attrs: { color: '#dc2626' } }] },
      ],
    },
    {
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { checked: true }, content: [para('done')] },
        { type: 'taskItem', attrs: { checked: false }, content: [para('todo')] },
      ],
    },
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: [{ type: 'tableHeader', content: [para('h')] }] },
        { type: 'tableRow', content: [{ type: 'tableCell', content: [para('c')] }] },
      ],
    },
    { type: 'callout', attrs: { emoji: '💡', variant: 'warning' }, content: [para('careful')] },
    {
      type: 'toggle',
      attrs: { open: false },
      content: [{ type: 'toggleSummary', content: [text('more')] }, para('hidden body')],
    },
    {
      type: 'captureEmbed',
      attrs: { sourceId: 'src-1', title: 'A video', sourceType: 'youtube', timestampSec: 90 },
    },
    {
      type: 'paragraph',
      content: [
        { type: 'noteMention', attrs: { noteId: 'n2', title: 'Other page' } },
        { type: 'sourceMention', attrs: { sourceId: 'src-2', title: 'An article' } },
      ],
    },
  ],
}

/** A document as the legacy capture-notes editor saved it, before this revamp. */
const LEGACY_DOC = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [text('old note ')] },
    { type: 'codeBlock', attrs: { language: null }, content: [text('print(1)')] },
    { type: 'image', attrs: { src: 'x', alt: 'a', title: null, key: 'notes/images/a.png' } },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://a.b' } }] }],
    },
    { type: 'bulletList', content: [{ type: 'listItem', content: [para('item')] }] },
    { type: 'blockquote', content: [para('quote')] },
  ],
}

function nodeTypes(node: { type?: string; content?: unknown[] }, out = new Set<string>()): Set<string> {
  if (node.type) out.add(node.type)
  for (const child of node.content ?? []) nodeTypes(child as { type?: string; content?: unknown[] }, out)
  return out
}

describe('combined note editor (all phases)', () => {
  it('keeps every node type of the shared document model through load and save', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const editor = makeEditor(FULL_DOC)
    const types = nodeTypes(editor.getJSON() as { type?: string; content?: unknown[] })
    for (const expected of [
      'heading',
      'taskList',
      'taskItem',
      'table',
      'tableRow',
      'tableHeader',
      'tableCell',
      'callout',
      'toggle',
      'toggleSummary',
      'captureEmbed',
      'noteMention',
      'sourceMention',
    ]) {
      expect(types, `${expected} should survive`).toContain(expected)
    }
    // No "Duplicate extension names" or unknown-node warnings from mixing the phases.
    expect(warn).not.toHaveBeenCalled()
  })

  it('keeps node attributes from the contract', () => {
    const json = makeEditor(FULL_DOC).getJSON() as { content: Array<Record<string, any>> }
    const byType = (type: string) => json.content.find(node => node.type === type)
    expect(byType('callout')?.attrs).toMatchObject({ emoji: '💡', variant: 'warning' })
    expect(byType('toggle')?.attrs).toMatchObject({ open: false })
    expect(byType('captureEmbed')?.attrs).toMatchObject({
      sourceId: 'src-1',
      sourceType: 'youtube',
      timestampSec: 90,
    })
    expect(byType('taskList')?.content?.[0]?.attrs).toMatchObject({ checked: true })
    expect(byType('heading')?.attrs).toMatchObject({ level: 1 })
  })

  it('loads a legacy capture-notes document without losing anything', () => {
    const editor = makeEditor(LEGACY_DOC)
    const types = nodeTypes(editor.getJSON() as { type?: string; content?: unknown[] })
    for (const expected of ['codeBlock', 'image', 'bulletList', 'blockquote'])
      expect(types).toContain(expected)
    const image = (editor.getJSON().content ?? []).find(node => node.type === 'image')
    expect(image?.attrs?.key).toBe('notes/images/a.png')
    const link = JSON.stringify(editor.getJSON())
    expect(link).toContain('https://a.b')
  })

  it('can insert each slash item without throwing and without breaking the document', () => {
    for (const item of allSlashItems) {
      const editor = makeEditor({ type: 'doc', content: [para('/x')] })
      editor.commands.setTextSelection(3)
      const range = { from: 1, to: 3 }
      editor.commands.deleteRange(range)
      // Items that open pickers or the file chooser dispatch DOM events; they must not throw.
      expect(() => item.run({ editor, range: { from: 1, to: 1 } }), item.id).not.toThrow()
      expect(editor.getJSON().type).toBe('doc')
      editor.destroy()
      editors.pop()
    }
  })

  it('offers unique slash ids across all four phases', () => {
    const ids = allSlashItems.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThan(15)
  })
})
