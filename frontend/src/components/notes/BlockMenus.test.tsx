import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import '@/test/layoutStubs'
import { createEditor, doc, getDoc, p } from '@/test/noteEditor'
import BlockHandleMenu from './BlockHandleMenu'
import CalloutEmojiPicker from './CalloutEmojiPicker'
import NoteBlockTools from './NoteBlockTools'
import TableMenu, { shouldShowTableMenu } from './TableMenu'
import { BLOCK_MENU_EVENT } from './extensions/blockHandle'
import { CALLOUT_EMOJI_EVENT } from './extensions/callout'

let editor: Editor
afterEach(() => {
  cleanup()
  editor?.destroy()
})

const order = () => getDoc(editor).content!.map((n) => n.content?.[0]?.text)

describe('TableMenu', () => {
  const tableDoc = () => {
    editor = createEditor(doc(p('before')))
    editor.commands.setTextSelection(3)
    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
  }

  it('shouldShowTableMenu is true only inside a table in an editable editor', () => {
    editor = createEditor(doc(p('text')))
    expect(shouldShowTableMenu({ editor })).toBe(false)
    editor.commands.insertTable({ rows: 2, cols: 2 })
    expect(shouldShowTableMenu({ editor })).toBe(true)
    editor.setEditable(false)
    expect(shouldShowTableMenu({ editor })).toBe(false)
  })

  it('appears when the cursor is in a table and runs row/column/header/delete actions', async () => {
    tableDoc()
    render(<TableMenu editor={editor} />)
    act(() => {
      editor.commands.setTextSelection(editor.state.selection.from)
    })
    const menu = await screen.findByTestId('table-menu', {}, { timeout: 2000 })
    await waitFor(() => expect(menu.parentElement!.style.visibility).not.toBe('hidden'))

    const dims = () => {
      const t = getDoc(editor).content!.find((n) => n.type === 'table')!
      return [t.content!.length, t.content![0].content!.length]
    }
    expect(dims()).toEqual([3, 3])
    fireEvent.click(screen.getByRole('button', { name: 'Add row below' }))
    expect(dims()).toEqual([4, 3])
    fireEvent.click(screen.getByRole('button', { name: 'Add column right' }))
    expect(dims()).toEqual([4, 4])
    fireEvent.click(screen.getByRole('button', { name: 'Delete row' }))
    expect(dims()).toEqual([3, 4])
    fireEvent.click(screen.getByRole('button', { name: 'Delete column' }))
    expect(dims()).toEqual([3, 3])
    fireEvent.click(screen.getByRole('button', { name: 'Toggle header row' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete table' }))
    expect(getDoc(editor).content!.some((n) => n.type === 'table')).toBe(false)
  })

  it('is hidden when the cursor leaves the table', async () => {
    tableDoc()
    render(<TableMenu editor={editor} />)
    act(() => {
      editor.commands.setTextSelection(editor.state.selection.from)
    })
    const menu = await screen.findByTestId('table-menu', {}, { timeout: 2000 })
    act(() => {
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2)))
    })
    expect(editor.isActive('table')).toBe(false)
    await waitFor(() => expect(menu.isConnected && menu.parentElement!.style.visibility !== 'hidden').toBe(false))
  })

  it('renders nothing without an editor', () => {
    const { container } = render(<TableMenu editor={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('BlockHandleMenu', () => {
  const openMenu = (index: number) => {
    act(() => {
      editor.view.dom.dispatchEvent(
        new CustomEvent(BLOCK_MENU_EVENT, {
          bubbles: true,
          detail: { index, rect: { left: 10, top: 20, bottom: 40 } },
        }),
      )
    })
  }

  const setup = () => {
    editor = createEditor(doc(p('a'), p('b'), p('c')))
    render(<BlockHandleMenu editor={editor} />)
  }

  it('is closed until the handle asks for it', () => {
    setup()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('Duplicate, Move up/down and Delete act on the chosen block', () => {
    setup()
    openMenu(1)
    fireEvent.click(screen.getByRole('menuitem', { name: /Duplicate/ }))
    expect(order()).toEqual(['a', 'b', 'b', 'c'])
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    openMenu(0)
    fireEvent.click(screen.getByRole('menuitem', { name: /Move down/ }))
    expect(order()).toEqual(['b', 'a', 'b', 'c'])

    openMenu(3)
    fireEvent.click(screen.getByRole('menuitem', { name: /Move up/ }))
    expect(order()).toEqual(['b', 'a', 'c', 'b'])

    openMenu(0)
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }))
    expect(order()).toEqual(['a', 'c', 'b'])
  })

  it('disables Move up on the first block and Move down on the last', () => {
    setup()
    openMenu(0)
    expect(screen.getByRole('menuitem', { name: /Move up/ })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: /Move down/ })).toBeEnabled()
    openMenu(2)
    expect(screen.getByRole('menuitem', { name: /Move down/ })).toBeDisabled()
  })

  it('Turn into opens the type list and converts that block only', () => {
    setup()
    openMenu(1)
    fireEvent.click(screen.getByRole('menuitem', { name: /Turn into/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Heading 2/ }))
    const blocks = getDoc(editor).content!
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'heading', 'paragraph'])
    expect(blocks[1].attrs).toEqual({ level: 2 })
    expect(blocks[1].content![0].text).toBe('b')
  })

  it('Back returns from the type list and Escape closes the menu', () => {
    setup()
    openMenu(1)
    fireEvent.click(screen.getByRole('menuitem', { name: /Turn into/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Back/ }))
    expect(screen.getByRole('menuitem', { name: /Duplicate/ })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on an outside press', () => {
    setup()
    openMenu(0)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('CalloutEmojiPicker', () => {
  const calloutDoc = doc(
    { type: 'callout', attrs: { emoji: '\u{1F4A1}', variant: 'info' }, content: [p('hi')] },
    p('after'),
  )
  const openPicker = (pos = 0) => {
    act(() => {
      editor.view.dom.dispatchEvent(
        new CustomEvent(CALLOUT_EMOJI_EVENT, { bubbles: true, detail: { pos } }),
      )
    })
  }

  it('clicking the emoji in the node view asks for the picker', () => {
    editor = createEditor(calloutDoc)
    render(<CalloutEmojiPicker editor={editor} />)
    const icon = editor.view.dom.querySelector('.note-callout-emoji') as HTMLElement
    expect(icon.textContent).toBe('\u{1F4A1}')
    fireEvent.mouseDown(icon)
    expect(screen.getByRole('dialog', { name: /Callout emoji/ })).toBeInTheDocument()
  })

  it('the emoji is not clickable in a read-only editor', () => {
    editor = createEditor(calloutDoc)
    render(<CalloutEmojiPicker editor={editor} />)
    editor.setEditable(false)
    fireEvent.mouseDown(editor.view.dom.querySelector('.note-callout-emoji')!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('picking an emoji updates that callout even when the cursor is elsewhere', () => {
    editor = createEditor(calloutDoc)
    render(<CalloutEmojiPicker editor={editor} />)
    editor.commands.setTextSelection(editor.state.doc.content.size - 1) // inside "after"
    openPicker(0)
    fireEvent.click(screen.getByRole('button', { name: 'Use \u{1F525}' }))
    expect(getDoc(editor).content![0].attrs).toEqual({ emoji: '\u{1F525}', variant: 'info' })
    expect(editor.view.dom.querySelector('.note-callout-emoji')!.textContent).toBe('\u{1F525}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('picking a style changes the variant', () => {
    editor = createEditor(calloutDoc)
    render(<CalloutEmojiPicker editor={editor} />)
    openPicker(0)
    fireEvent.click(screen.getByRole('button', { name: 'Danger' }))
    expect(getDoc(editor).content![0].attrs?.variant).toBe('danger')
    expect(editor.view.dom.querySelector('[data-callout]')!.getAttribute('data-variant')).toBe('danger')
  })

  it('Escape closes it', () => {
    editor = createEditor(calloutDoc)
    render(<CalloutEmojiPicker editor={editor} />)
    openPicker(0)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('NoteBlockTools', () => {
  it('mounts all four tools against one editor without errors', () => {
    editor = createEditor(doc(p('x')))
    const { container } = render(<NoteBlockTools editor={editor} />)
    expect(container).toBeInTheDocument()
    cleanup()
    const { container: empty } = render(<NoteBlockTools editor={null} />)
    expect(empty).toBeEmptyDOMElement()
  })
})
