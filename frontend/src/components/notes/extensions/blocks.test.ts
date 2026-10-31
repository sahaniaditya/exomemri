import { afterEach, describe, expect, it } from 'vitest'
import type { Editor, JSONContent } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { closeHistory, createEditor, getDoc, doc, p, pressKey, typeText } from '@/test/noteEditor'
import { blockExtensions } from './blocks'
import { NOTE_HIGHLIGHT_COLORS, NOTE_TEXT_COLORS } from '@/lib/notes/palette'

let editor: Editor
afterEach(() => editor?.destroy())

const text = (t: string, marks?: JSONContent['marks']): JSONContent =>
  marks ? { type: 'text', text: t, marks } : { type: 'text', text: t }

/** Put the caret at the end of the first text block whose text equals `label` (or is empty). */
function placeCaretIn(ed: Editor, label: string): void {
  let target = -1
  ed.state.doc.descendants((node, pos) => {
    if (target === -1 && node.isTextblock && node.textContent === label) target = pos + node.nodeSize - 1
  })
  expect(target, `text block "${label}"`).toBeGreaterThan(-1)
  ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, target)))
}

function expectRoundTrip(json: JSONContent): void {
  editor = createEditor(json)
  expect(getDoc(editor)).toEqual(json)
}

describe('document model round trips', () => {
  it('nested task list with checked state', () => {
    expectRoundTrip(
      doc({
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [
              p('done'),
              {
                type: 'taskList',
                content: [{ type: 'taskItem', attrs: { checked: false }, content: [p('child')] }],
              },
            ],
          },
          { type: 'taskItem', attrs: { checked: false }, content: [p('todo')] },
        ],
      }),
    )
  })

  it('table with header row', () => {
    expectRoundTrip(
      doc({
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null }, content: [p('H1')] },
              { type: 'tableHeader', attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null }, content: [p('H2')] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null }, content: [p('a')] },
              { type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null }, content: [p('b')] },
            ],
          },
        ],
      }),
    )
  })

  it.each(['info', 'success', 'warning', 'danger'])('callout variant %s', (variant) => {
    expectRoundTrip(
      doc({
        type: 'callout',
        attrs: { emoji: '🔥', variant },
        content: [p('one'), p('two')],
      }),
    )
  })

  it('callout default attrs are emoji 💡 and variant info', () => {
    editor = createEditor(doc({ type: 'callout', content: [p('x')] }))
    expect(getDoc(editor).content![0].attrs).toEqual({ emoji: '💡', variant: 'info' })
  })

  it.each([true, false])('toggle open=%s', (open) => {
    expectRoundTrip(
      doc({
        type: 'toggle',
        attrs: { open },
        content: [{ type: 'toggleSummary', content: [text('Summary')] }, p('body'), p('more')],
      }),
    )
  })

  it('toggle without a body', () => {
    expectRoundTrip(
      doc({ type: 'toggle', attrs: { open: true }, content: [{ type: 'toggleSummary' }] }),
    )
  })

  it('highlight and colour marks', () => {
    const hl = NOTE_HIGHLIGHT_COLORS[0].value
    const col = NOTE_TEXT_COLORS[1].value
    expectRoundTrip(
      doc({
        type: 'paragraph',
        content: [
          text('hl', [{ type: 'highlight', attrs: { color: hl } }]),
          text('col', [{ type: 'textStyle', attrs: { color: col } }]),
        ],
      }),
    )
  })

  it('highlight without colour keeps color null', () => {
    expectRoundTrip(
      doc({
        type: 'paragraph',
        content: [text('x', [{ type: 'highlight', attrs: { color: null } }])],
      }),
    )
  })

  it('blockExtensions() registers every contract name', () => {
    editor = createEditor()
    const names = Object.keys(editor.schema.nodes).concat(Object.keys(editor.schema.marks))
    for (const n of [
      'taskList', 'taskItem', 'table', 'tableRow', 'tableHeader', 'tableCell',
      'callout', 'toggle', 'toggleSummary', 'highlight', 'textStyle',
    ]) {
      expect(names).toContain(n)
    }
    expect(blockExtensions().length).toBeGreaterThan(8)
  })
})

describe('legacy documents load unchanged', () => {
  it('paragraph, link, code block, image, lists, quote, rule', () => {
    const legacy = doc(
      { type: 'paragraph', content: [text('see '), text('here', [{ type: 'link', attrs: { href: 'https://x.test', target: '_blank', rel: 'noopener noreferrer', class: null } }])] },
      { type: 'codeBlock', attrs: { language: 'ts' }, content: [text('const a = 1')] },
      { type: 'image', attrs: { src: null, alt: null, title: null, key: 'k1' } },
      { type: 'bulletList', content: [{ type: 'listItem', content: [p('b')] }] },
      { type: 'orderedList', attrs: { start: 1, type: null }, content: [{ type: 'listItem', content: [p('o')] }] },
      { type: 'blockquote', content: [p('q')] },
      { type: 'horizontalRule' },
      { type: 'paragraph', content: [text('b', [{ type: 'bold' }, { type: 'italic' }, { type: 'code' }])] },
    )
    editor = createEditor(doc(p()))
    editor.commands.setContent(legacy)
    const out = getDoc(editor)
    expect(out.content!.map((n) => n.type)).toEqual(legacy.content!.map((n) => n.type))
    expect(out.content![2].attrs).toMatchObject({ key: 'k1' })
  })
})

describe('input rules', () => {
  it('"[ ] " creates an unchecked task item', () => {
    editor = createEditor()
    typeText(editor, '[ ] ')
    typeText(editor, 'todo')
    expect(getDoc(editor).content![0]).toMatchObject({
      type: 'taskList',
      content: [{ type: 'taskItem', attrs: { checked: false }, content: [p('todo')] }],
    })
  })

  it('"[x] " creates a checked task item', () => {
    editor = createEditor()
    typeText(editor, '[x] done')
    expect(getDoc(editor).content![0].content![0]).toMatchObject({
      type: 'taskItem',
      attrs: { checked: true },
    })
  })
})

describe('commands', () => {
  it('insertTable creates a 3x3 table with a header row', () => {
    editor = createEditor()
    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
    const table = getDoc(editor).content![0]
    expect(table.type).toBe('table')
    expect(table.content).toHaveLength(3)
    expect(table.content!.map((r) => r.content!.length)).toEqual([3, 3, 3])
    expect(table.content![0].content!.every((c) => c.type === 'tableHeader')).toBe(true)
    expect(table.content![1].content!.every((c) => c.type === 'tableCell')).toBe(true)
  })

  it('adds and deletes rows and columns, toggles header, deletes the table', () => {
    editor = createEditor()
    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
    const dims = () => {
      const t = getDoc(editor).content![0]
      return [t.content!.length, t.content![0].content!.length]
    }
    expect(editor.commands.addRowAfter()).toBe(true)
    expect(dims()).toEqual([4, 3])
    expect(editor.commands.addColumnAfter()).toBe(true)
    expect(dims()).toEqual([4, 4])
    expect(editor.commands.deleteRow()).toBe(true)
    expect(dims()).toEqual([3, 4])
    expect(editor.commands.deleteColumn()).toBe(true)
    expect(dims()).toEqual([3, 3])
    // The cursor was in the header row, so deleting that row removed the header.
    const firstCell = () => getDoc(editor).content![0].content![0].content![0].type
    expect(firstCell()).toBe('tableCell')
    expect(editor.commands.toggleHeaderRow()).toBe(true)
    expect(firstCell()).toBe('tableHeader')
    expect(editor.commands.toggleHeaderRow()).toBe(true)
    expect(firstCell()).toBe('tableCell')
    expect(editor.commands.deleteTable()).toBe(true)
    expect(getDoc(editor).content!.some((n) => n.type === 'table')).toBe(false)
  })

  it('row/column commands are rejected outside a table', () => {
    editor = createEditor()
    expect(editor.commands.addRowAfter()).toBe(false)
    expect(editor.isActive('table')).toBe(false)
  })

  it('sets and unsets highlight and colour on a selection', () => {
    editor = createEditor(doc(p('hello')))
    editor.commands.selectAll()
    const hl = NOTE_HIGHLIGHT_COLORS[0].value
    const col = NOTE_TEXT_COLORS[2].value
    editor.chain().setHighlight({ color: hl }).setColor(col).run()
    const marks = getDoc(editor).content![0].content![0].marks!
    expect(marks).toHaveLength(2)
    expect(marks).toContainEqual({ type: 'highlight', attrs: { color: hl } })
    expect(marks).toContainEqual({ type: 'textStyle', attrs: { color: col } })
    editor.chain().unsetHighlight().unsetColor().run()
    const after = getDoc(editor).content![0].content![0].marks ?? []
    expect(after.find((m) => m.type === 'highlight')).toBeUndefined()
    expect(after.find((m) => m.type === 'textStyle')?.attrs?.color ?? null).toBeNull()
  })

  it('the palettes have 6 colours each, all CSS variables', () => {
    expect(NOTE_HIGHLIGHT_COLORS).toHaveLength(6)
    expect(NOTE_TEXT_COLORS).toHaveLength(6)
    for (const c of [...NOTE_HIGHLIGHT_COLORS, ...NOTE_TEXT_COLORS]) {
      expect(c.value).toMatch(/^var\(--note-(text|hl)-[a-z]+\)$/)
    }
  })

  it('insertCallout, setCalloutVariant and setCalloutEmoji', () => {
    editor = createEditor()
    editor.commands.insertCallout()
    expect(getDoc(editor).content![0]).toMatchObject({
      type: 'callout',
      attrs: { emoji: '💡', variant: 'info' },
    })
    expect(editor.commands.setCalloutVariant('danger')).toBe(true)
    expect(editor.commands.setCalloutEmoji('🔥')).toBe(true)
    expect(getDoc(editor).content![0].attrs).toEqual({ emoji: '🔥', variant: 'danger' })
  })

  it('setCalloutVariant fails outside a callout', () => {
    editor = createEditor(doc(p('x')))
    expect(editor.commands.setCalloutVariant('success')).toBe(false)
  })

  it('setCallout wraps the current paragraph', () => {
    editor = createEditor(doc(p('wrap me')))
    editor.commands.setCallout({ variant: 'warning' })
    expect(getDoc(editor).content![0]).toMatchObject({
      type: 'callout',
      attrs: { variant: 'warning' },
      content: [p('wrap me')],
    })
  })

  it('insertToggle and setToggleOpen', () => {
    editor = createEditor()
    editor.commands.insertToggle()
    const toggle = getDoc(editor).content![0]
    expect(toggle).toMatchObject({ type: 'toggle', attrs: { open: true } })
    expect(toggle.content![0].type).toBe('toggleSummary')
    expect(editor.commands.setToggleOpen(false)).toBe(true)
    expect(getDoc(editor).content![0].attrs).toEqual({ open: false })
    expect(editor.commands.setToggleOpen(true, 0)).toBe(true)
    expect(getDoc(editor).content![0].attrs).toEqual({ open: true })
  })

  it('setToggleOpen fails when there is no toggle', () => {
    editor = createEditor(doc(p('x')))
    expect(editor.commands.setToggleOpen(false)).toBe(false)
    expect(editor.commands.setToggleOpen(false, 0)).toBe(false)
  })

  it('toggle open state change is undoable', () => {
    editor = createEditor(
      doc({ type: 'toggle', attrs: { open: true }, content: [{ type: 'toggleSummary', content: [text('S')] }] }),
    )
    editor.commands.setToggleOpen(false, 0)
    expect(getDoc(editor).content![0].attrs?.open).toBe(false)
    editor.commands.undo()
    expect(getDoc(editor).content![0].attrs?.open).toBe(true)
  })
})

describe('toggle node view', () => {
  const closed = doc({
    type: 'toggle',
    attrs: { open: false },
    content: [{ type: 'toggleSummary', content: [text('S')] }, p('body')],
  })

  it('renders the open state and the arrow flips it in the document', () => {
    editor = createEditor(closed)
    const dom = editor.view.dom.querySelector('[data-toggle]')!
    expect(dom.getAttribute('data-open')).toBe('false')
    const arrow = dom.querySelector('button')!
    expect(arrow.getAttribute('aria-expanded')).toBe('false')
    arrow.click()
    expect(getDoc(editor).content![0].attrs?.open).toBe(true)
    expect(editor.view.dom.querySelector('[data-toggle]')!.getAttribute('data-open')).toBe('true')
    closeHistory(editor)
    editor.view.dom.querySelector('button')!.click()
    expect(getDoc(editor).content![0].attrs?.open).toBe(false)
    editor.commands.undo()
    expect(getDoc(editor).content![0].attrs?.open).toBe(true)
  })

  it('does not change the document when the editor is read-only', () => {
    editor = createEditor(closed)
    editor.setEditable(false)
    const arrow = editor.view.dom.querySelector('[data-toggle] button') as HTMLButtonElement
    arrow.click()
    expect(getDoc(editor).content![0].attrs?.open).toBe(false)
    expect(editor.view.dom.querySelector('[data-toggle]')!.getAttribute('data-open')).toBe('true')
  })
})

describe('task item checkbox', () => {
  const tasks = doc({
    type: 'taskList',
    content: [{ type: 'taskItem', attrs: { checked: false }, content: [p('t')] }],
  })

  it('toggles checked state in the JSON when editable', () => {
    editor = createEditor(tasks)
    const box = editor.view.dom.querySelector('input[type=checkbox]') as HTMLInputElement
    box.click()
    expect(getDoc(editor).content![0].content![0].attrs?.checked).toBe(true)
  })

  it('does not change when the editor is read-only', () => {
    editor = createEditor(tasks)
    editor.setEditable(false)
    const box = editor.view.dom.querySelector('input[type=checkbox]') as HTMLInputElement
    box.click()
    expect(getDoc(editor).content![0].content![0].attrs?.checked).toBe(false)
  })
})

describe('callout keyboard behaviour', () => {
  const callout = (...content: JSONContent[]) =>
    doc({ type: 'callout', attrs: { emoji: '💡', variant: 'info' }, content }, p('after'))

  it('Enter on an empty last line exits the callout', () => {
    editor = createEditor(callout(p('one'), p()))
    placeCaretIn(editor, '')
    expect(pressKey(editor, 'Enter')).toBe(true)
    const json = getDoc(editor)
    expect(json.content![0].content).toEqual([p('one')])
    expect(json.content!.map((n) => n.type)).toEqual(['callout', 'paragraph', 'paragraph'])
    expect(editor.state.selection.$from.depth).toBe(1)
    expect(editor.state.selection.$from.parent.textContent).toBe('')
    expect(editor.state.selection.$from.index(0)).toBe(1)
  })

  it('Enter on an empty only line lifts out of the callout', () => {
    editor = createEditor(callout(p()))
    placeCaretIn(editor, '')
    expect(pressKey(editor, 'Enter')).toBe(true)
    expect(getDoc(editor).content!.map((n) => n.type)).toEqual(['paragraph', 'paragraph'])
  })

  it('Enter on a non-empty line stays inside the callout', () => {
    editor = createEditor(callout(p('one')))
    placeCaretIn(editor, 'one')
    pressKey(editor, 'Enter')
    expect(getDoc(editor).content![0].content).toHaveLength(2)
  })

  it('Enter on an empty line that is not last stays inside', () => {
    editor = createEditor(callout(p(), p('two')))
    placeCaretIn(editor, '')
    pressKey(editor, 'Enter')
    // The default empty-block behaviour (split the callout around the line) applies; nothing is lost.
    expect(editor.state.doc.textContent).toBe('twoafter')
    expect(getDoc(editor).content!.some((n) => n.type === 'callout')).toBe(true)
  })

  it('Backspace at the start lifts the first block out of the callout', () => {
    editor = createEditor(callout(p('one'), p('two')))
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2)),
    )
    expect(pressKey(editor, 'Backspace')).toBe(true)
    const json = getDoc(editor)
    expect(json.content![0]).toEqual(p('one'))
    expect(json.content![1]).toMatchObject({ type: 'callout', content: [p('two')] })
  })

  it('Backspace at the start of a single-line callout turns it into a paragraph', () => {
    editor = createEditor(callout(p('only')))
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2)))
    pressKey(editor, 'Backspace')
    expect(getDoc(editor).content![0]).toEqual(p('only'))
  })

  it('Backspace mid-text is not intercepted', () => {
    editor = createEditor(callout(p('one')))
    placeCaretIn(editor, 'one')
    expect(getDoc(editor).content![0].type).toBe('callout')
    pressKey(editor, 'Backspace')
    expect(getDoc(editor).content![0].type).toBe('callout')
  })
})

describe('toggle keyboard behaviour', () => {
  const toggle = (open: boolean, ...body: JSONContent[]) =>
    doc({
      type: 'toggle',
      attrs: { open },
      content: [{ type: 'toggleSummary', content: [text('Sum')] }, ...body],
    })

  it('Enter in the summary moves into the existing body', () => {
    editor = createEditor(toggle(true, p('body')))
    placeCaretIn(editor, 'Sum')
    expect(pressKey(editor, 'Enter')).toBe(true)
    expect(editor.state.selection.$from.parent.textContent).toBe('body')
    expect(getDoc(editor).content![0].content).toHaveLength(2)
  })

  it('Enter in the summary creates a body line when there is none', () => {
    editor = createEditor(toggle(true))
    placeCaretIn(editor, 'Sum')
    pressKey(editor, 'Enter')
    const t = getDoc(editor).content![0]
    expect(t.content).toHaveLength(2)
    expect(t.content![1].type).toBe('paragraph')
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
  })

  it('Enter on a closed toggle opens it', () => {
    editor = createEditor(toggle(false, p('body')))
    placeCaretIn(editor, 'Sum')
    pressKey(editor, 'Enter')
    expect(getDoc(editor).content![0].attrs?.open).toBe(true)
  })

  it('Backspace in an empty summary with no body turns the toggle into a paragraph', () => {
    editor = createEditor(
      doc({ type: 'toggle', attrs: { open: true }, content: [{ type: 'toggleSummary' }] }),
    )
    placeCaretIn(editor, '')
    expect(pressKey(editor, 'Backspace')).toBe(true)
    expect(getDoc(editor).content![0]).toEqual({ type: 'paragraph' })
    expect(getDoc(editor).content!.some((n) => n.type === 'toggle')).toBe(false)
  })

  it('Backspace in an empty summary that has a body is left alone', () => {
    editor = createEditor(
      doc({ type: 'toggle', attrs: { open: true }, content: [{ type: 'toggleSummary' }, p('b')] }),
    )
    placeCaretIn(editor, '')
    pressKey(editor, 'Backspace')
    expect(getDoc(editor).content![0].type).toBe('toggle')
  })
})

describe('block handle commands', () => {
  const three = doc(p('a'), p('b'), p('c'))
  const order = () => getDoc(editor).content!.map((n) => n.content?.[0]?.text)

  it('moveBlockTo reorders and undo restores the order in one step', () => {
    editor = createEditor(three)
    expect(editor.commands.moveBlockTo(0, 2)).toBe(true)
    expect(order()).toEqual(['b', 'c', 'a'])
    editor.commands.undo()
    expect(order()).toEqual(['a', 'b', 'c'])
    editor.commands.redo()
    expect(order()).toEqual(['b', 'c', 'a'])
  })

  it('moveBlockTo rejects bad indices and no-ops', () => {
    editor = createEditor(three)
    expect(editor.commands.moveBlockTo(0, 3)).toBe(false)
    expect(editor.commands.moveBlockTo(-1, 0)).toBe(false)
    expect(editor.commands.moveBlockTo(1, 1)).toBe(false)
    expect(order()).toEqual(['a', 'b', 'c'])
  })

  it('moves complex blocks without losing nested content', () => {
    const toggle: JSONContent = {
      type: 'toggle',
      attrs: { open: false },
      content: [{ type: 'toggleSummary', content: [text('S')] }, p('x'), { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p('t')] }] }],
    }
    editor = createEditor(doc(p('first'), toggle))
    editor.commands.moveBlockTo(1, 0)
    expect(getDoc(editor).content![0]).toEqual(toggle)
    expect(getDoc(editor).content![1]).toEqual(p('first'))
  })

  it('Alt+ArrowDown / Alt+ArrowUp move the current block and the caret follows', () => {
    editor = createEditor(three)
    placeCaretIn(editor, 'a')
    expect(pressKey(editor, 'ArrowDown', { altKey: true })).toBe(true)
    expect(order()).toEqual(['b', 'a', 'c'])
    expect(editor.state.selection.$from.parent.textContent).toBe('a')
    expect(pressKey(editor, 'ArrowUp', { altKey: true })).toBe(true)
    expect(order()).toEqual(['a', 'b', 'c'])
  })

  it('Alt+Arrow at the edges does nothing', () => {
    editor = createEditor(three)
    placeCaretIn(editor, 'a')
    expect(pressKey(editor, 'ArrowUp', { altKey: true })).toBe(false)
    placeCaretIn(editor, 'c')
    expect(pressKey(editor, 'ArrowDown', { altKey: true })).toBe(false)
    expect(order()).toEqual(['a', 'b', 'c'])
  })

  it('duplicateBlockAt and deleteBlockAt', () => {
    editor = createEditor(three)
    expect(editor.commands.duplicateBlockAt(1)).toBe(true)
    expect(order()).toEqual(['a', 'b', 'b', 'c'])
    closeHistory(editor)
    expect(editor.commands.deleteBlockAt(0)).toBe(true)
    expect(order()).toEqual(['b', 'b', 'c'])
    editor.commands.undo()
    expect(order()).toEqual(['a', 'b', 'b', 'c'])
    expect(editor.commands.duplicateBlockAt(9)).toBe(false)
    expect(editor.commands.deleteBlockAt(-1)).toBe(false)
  })

  it('deleting the only block leaves an empty paragraph', () => {
    editor = createEditor(doc(p('only')))
    editor.commands.deleteBlockAt(0)
    expect(getDoc(editor).content).toEqual([{ type: 'paragraph' }])
  })

  it('turnBlockInto converts a paragraph into a heading and a list into paragraphs', () => {
    editor = createEditor(doc(p('t'), { type: 'bulletList', content: [{ type: 'listItem', content: [p('i1')] }, { type: 'listItem', content: [p('i2')] }] }))
    editor.commands.turnBlockInto(0, 'heading2')
    expect(getDoc(editor).content![0]).toEqual({ type: 'heading', attrs: { level: 2 }, content: [text('t')] })
    closeHistory(editor)
    editor.commands.turnBlockInto(1, 'paragraph')
    expect(getDoc(editor).content!.slice(1, 3)).toEqual([p('i1'), p('i2')])
    editor.commands.undo()
    expect(getDoc(editor).content![1].type).toBe('bulletList')
  })

  it.each(['callout', 'toggle', 'taskList', 'blockquote', 'codeBlock', 'orderedList'] as const)(
    'turnBlockInto %s produces a schema-valid document',
    (target) => {
      editor = createEditor(doc(p('hello')))
      expect(editor.commands.turnBlockInto(0, target)).toBe(true)
      expect(() => editor.state.doc.check()).not.toThrow()
      expect(editor.state.doc.textContent).toBe('hello')
    },
  )

  it('turnSelectionInto heading from a list item flattens the list (items cannot start with a heading)', () => {
    editor = createEditor(
      doc({ type: 'bulletList', content: [{ type: 'listItem', content: [p('x')] }, { type: 'listItem', content: [p('y')] }] }),
    )
    placeCaretIn(editor, 'x')
    editor.commands.turnSelectionInto('heading1')
    // A list item must start with a paragraph, so the list is flattened: the text becomes a heading.
    const types = getDoc(editor).content!.map((n) => n.type)
    expect(types[0]).toBe('heading')
    expect(editor.state.doc.textContent).toContain('xy')
  })

  it('turnSelectionInto on a top-level block converts it', () => {
    editor = createEditor(doc(p('a'), p('b')))
    placeCaretIn(editor, 'b')
    editor.commands.turnSelectionInto('callout')
    expect(getDoc(editor).content![1].type).toBe('callout')
    expect(getDoc(editor).content![0].type).toBe('paragraph')
  })

  it('registers a handle and drop indicator in the page and removes them on destroy', () => {
    editor = createEditor(three)
    expect(document.querySelector('.note-block-handle')).not.toBeNull()
    expect(document.querySelector('.note-drop-indicator')).not.toBeNull()
    editor.destroy()
    expect(document.querySelector('.note-block-handle')).toBeNull()
  })
})
