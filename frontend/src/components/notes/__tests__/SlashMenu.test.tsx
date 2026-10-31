import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Editor } from '@tiptap/core'
import SlashMenu, { computeSlashMenuPosition } from '../SlashMenu'
import { buildNoteExtensions } from '../extensions'
import { installLayoutStubs } from './jsdomStubs'

const scope = { kind: 'space' as const, spaceId: 's1' }

function makeEditor(): Editor {
  return new Editor({
    extensions: buildNoteExtensions(scope),
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
  })
}

afterEach(() => cleanup())

describe('SlashMenu', () => {
  it('renders nothing until the slash trigger is typed', () => {
    installLayoutStubs()
    const editor = makeEditor()
    render(<SlashMenu editor={editor} />)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    editor.destroy()
  })

  it('lists grouped items, filters by query and selects on click', async () => {
    installLayoutStubs()
    const editor = makeEditor()
    render(<SlashMenu editor={editor} />)

    act(() => {
      editor.commands.focus()
      editor.commands.insertContent('/')
    })
    expect(await screen.findByRole('listbox', { name: 'Insert block' })).toBeInTheDocument()
    expect(await screen.findByText('Basic')).toBeInTheDocument()
    expect(screen.getByText('Media')).toBeInTheDocument()
    expect(screen.getAllByRole('option').length).toBeGreaterThan(8)

    act(() => {
      editor.commands.insertContent('quo')
    })
    const options = await screen.findAllByRole('option')
    await act(async () => {})
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(options[0]).toHaveTextContent('Quote')

    fireEvent.click(screen.getByRole('option', { name: /Quote/ }))
    expect(editor.getJSON().content?.[0].type).toBe('blockquote')
    expect(editor.getText()).not.toContain('/')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    editor.destroy()
  })

  it('shows an empty state when nothing matches', async () => {
    installLayoutStubs()
    const editor = makeEditor()
    render(<SlashMenu editor={editor} />)
    act(() => {
      editor.commands.focus()
      editor.commands.insertContent('/zzzzzz')
    })
    expect(await screen.findByText('No results')).toBeInTheDocument()
    editor.destroy()
  })

  it('marks the keyboard-selected option', async () => {
    installLayoutStubs()
    const editor = makeEditor()
    render(<SlashMenu editor={editor} />)
    act(() => {
      editor.commands.focus()
      editor.commands.insertContent('/head')
    })
    await screen.findAllByRole('option')
    await act(async () => {})
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')
    act(() => {
      editor.view.someProp('handleKeyDown', f =>
        f(editor.view, new KeyboardEvent('keydown', { key: 'ArrowDown' }))
      )
    })
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
    editor.destroy()
  })

  it('tolerates a missing editor', () => {
    render(<SlashMenu editor={null} />)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

describe('computeSlashMenuPosition', () => {
  const viewport = { width: 1000, height: 800 }

  it('opens below the caret when there is room', () => {
    expect(computeSlashMenuPosition({ top: 100, bottom: 120, left: 200 }, 300, viewport)).toEqual({
      top: 126,
      left: 200,
    })
  })

  it('flips above the caret near the bottom of the viewport', () => {
    const pos = computeSlashMenuPosition({ top: 700, bottom: 720, left: 200 }, 300, viewport)
    expect(pos.top).toBe(700 - 6 - 300)
  })

  it('stays below when there is no room above either', () => {
    const pos = computeSlashMenuPosition({ top: 100, bottom: 120, left: 200 }, 790, viewport)
    expect(pos.top).toBe(126)
  })

  it('clamps horizontally into the viewport', () => {
    expect(computeSlashMenuPosition({ top: 0, bottom: 10, left: 990 }, 100, viewport).left).toBe(
      1000 - 288 - 8
    )
    expect(computeSlashMenuPosition({ top: 0, bottom: 10, left: -50 }, 100, viewport).left).toBe(8)
  })
})
