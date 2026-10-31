import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, act } from '@testing-library/react'
import { EditorContent } from '@tiptap/react'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { captureExtensions } from './captureExtensions'
import { clearLinkablesCache } from '@/lib/notes/linkables'
import { jsonResponse, stubFetch } from '../testUtils'

let editor: Editor | null = null

beforeEach(() => {
  clearLinkablesCache()
  window.history.replaceState({}, '', '/dashboard/spaces/s1/notes/current')
  stubFetch(({ url }) =>
    url.endsWith('/sources')
      ? jsonResponse(200, { sources: [{ id: 'src1', title: 'Raft video', type: 'youtube' }] })
      : jsonResponse(200, {
          items: [
            { id: 'n2', title: 'Raft notes', icon: null, parent_id: null, sort_order: 0, updated_at: null },
            { id: 'current', title: 'Raft (this page)', icon: null, parent_id: null, sort_order: 1, updated_at: null },
          ],
        })
  )
  // ProseMirror asks for client rects when positioning; jsdom has none.
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect(10, 10, 0, 0)
})
afterEach(() => {
  cleanup()
  editor?.destroy()
  editor = null
  vi.unstubAllGlobals()
})

function mount() {
  editor = new Editor({
    extensions: [StarterKit, ...captureExtensions()],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
  })
  // Suggestion popups render through the mounted <EditorContent> (as in the app).
  render(<EditorContent editor={editor} />)
  return editor
}

describe('@ mention suggestion (real plugin)', () => {
  it('opens a list of this space\'s captures and pages when "@" is typed, excluding the open page', async () => {
    const ed = mount()
    await act(async () => {
      ed.commands.focus()
      ed.view.dispatch(ed.state.tr.insertText('@raf'))
    })
    const list = await screen.findByRole('listbox', { name: 'Mention a capture or page' })
    const options = Array.from(list.querySelectorAll('[role="option"]')).map(o => o.textContent)
    expect(options).toHaveLength(2)
    expect(options.join('|')).toContain('Raft video')
    expect(options.join('|')).toContain('Raft notes')
    expect(options.join('|')).not.toContain('this page')
  })

  it('does not open for text without "@"', async () => {
    const ed = mount()
    await act(async () => {
      ed.view.dispatch(ed.state.tr.insertText('hello raf'))
    })
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows "No matches" for a query that matches nothing', async () => {
    const ed = mount()
    await act(async () => {
      ed.view.dispatch(ed.state.tr.insertText('@zzzz'))
    })
    expect(await screen.findByText('No matches')).toBeInTheDocument()
  })

  it('degrades to an empty list when the lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    clearLinkablesCache()
    stubFetch(() => jsonResponse(500))
    const ed = mount()
    await act(async () => {
      ed.view.dispatch(ed.state.tr.insertText('@raf'))
    })
    await waitFor(() => expect(screen.getByText('No matches')).toBeInTheDocument())
  })
})
