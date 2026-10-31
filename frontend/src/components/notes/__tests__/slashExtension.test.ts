import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildNoteExtensions } from '../extensions'
import { NOTE_PICK_IMAGE_EVENT } from '../slash/items-basic'
import type { SlashController } from '../slash/slashController'

const scope = { kind: 'space' as const, spaceId: 's1' }
const editors: Editor[] = []

function makeEditor(content?: Record<string, unknown>): Editor {
  const editor = new Editor({
    extensions: buildNoteExtensions(scope),
    content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
  })
  editors.push(editor)
  return editor
}

const controllerOf = (editor: Editor): SlashController =>
  (editor.storage as unknown as { slash: { controller: SlashController } }).slash.controller

function keydown(editor: Editor, key: string): boolean {
  return Boolean(
    editor.view.someProp('handleKeyDown', f =>
      f(editor.view, new KeyboardEvent('keydown', { key }))
    )
  )
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
})

describe('slash extension', () => {
  it('opens on "/" and filters as the query is typed', async () => {
    const editor = makeEditor()
    editor.commands.focus()
    editor.commands.insertContent('/')
    await vi.waitFor(() => expect(controllerOf(editor).getState().open).toBe(true))
    await vi.waitFor(() =>
      expect(controllerOf(editor).getState().items.length).toBeGreaterThan(5)
    )

    editor.commands.insertContent('head')
    await vi.waitFor(() => {
      const state = controllerOf(editor).getState()
      expect(state.query).toBe('head')
      expect(state.items.map(i => i.id)).toEqual(['heading-1', 'heading-2', 'heading-3'])
    })
  })

  it('arrow keys move the selection and Enter runs the item and removes the trigger text', async () => {
    const editor = makeEditor()
    editor.commands.focus()
    editor.commands.insertContent('/head')
    await vi.waitFor(() => expect(controllerOf(editor).getState().items).toHaveLength(3))

    expect(keydown(editor, 'ArrowDown')).toBe(true)
    expect(controllerOf(editor).getState().selectedIndex).toBe(1)
    expect(keydown(editor, 'ArrowUp')).toBe(true)
    expect(controllerOf(editor).getState().selectedIndex).toBe(0)
    expect(keydown(editor, 'ArrowDown')).toBe(true)

    expect(keydown(editor, 'Enter')).toBe(true)
    const first = editor.getJSON().content?.[0]
    expect(first?.type).toBe('heading')
    expect(first?.attrs?.level).toBe(2)
    expect(editor.getText()).not.toContain('/')
    expect(editor.getText()).not.toContain('head')
    await vi.waitFor(() => expect(controllerOf(editor).getState().open).toBe(false))
  })

  it('Escape closes the menu without changing the document', async () => {
    const editor = makeEditor()
    editor.commands.focus()
    editor.commands.insertContent('/q')
    await vi.waitFor(() => expect(controllerOf(editor).getState().open).toBe(true))
    expect(keydown(editor, 'Escape')).toBe(true)
    expect(controllerOf(editor).getState().open).toBe(false)
    expect(editor.getText()).toBe('/q')
  })

  it('does not consume keys when closed', () => {
    const editor = makeEditor()
    const controller = controllerOf(editor)
    for (const key of ['Enter', 'ArrowDown', 'ArrowUp', 'Escape', 'Tab']) {
      expect(controller.handleKey(key)).toBe(false)
    }
  })

  it('stays closed inside a code block', async () => {
    const editor = makeEditor({
      type: 'doc',
      content: [{ type: 'codeBlock', content: [{ type: 'text', text: 'a ' }] }],
    })
    editor.commands.focus('end')
    editor.commands.insertContent('/')
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(controllerOf(editor).getState().open).toBe(false)
    expect(editor.getText()).toContain('/')
  })

  it('stays closed when "/" is mid-word (e.g. "and/or")', async () => {
    const editor = makeEditor()
    editor.commands.focus()
    editor.commands.insertContent('and/or')
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(controllerOf(editor).getState().open).toBe(false)
  })

  it('the Image item asks for the file picker and removes the trigger text', async () => {
    const editor = makeEditor()
    const listener = vi.fn()
    editor.view.dom.addEventListener(NOTE_PICK_IMAGE_EVENT, listener)
    editor.commands.focus()
    editor.commands.insertContent('/image')
    await vi.waitFor(() => expect(controllerOf(editor).getState().items[0]?.id).toBe('image'))
    keydown(editor, 'Enter')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(editor.getText()).toBe('')
  })

  it('basic items transform blocks', async () => {
    const editor = makeEditor()
    editor.commands.focus()
    editor.commands.insertContent('/bullet')
    await vi.waitFor(() =>
      expect(controllerOf(editor).getState().items[0]?.id).toBe('bullet-list')
    )
    keydown(editor, 'Enter')
    expect(editor.getJSON().content?.[0].type).toBe('bulletList')
  })
})
