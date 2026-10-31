import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Editor, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import OutlinePanel, { scrollToHeading } from './OutlinePanel'
import BacklinksPanel from './BacklinksPanel'
import { jsonResponse, stubFetch } from './testUtils'

const doc = (...content: unknown[]) => ({ type: 'doc', content })
const heading = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
})
const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

let editor: Editor | null = null
afterEach(() => {
  cleanup()
  editor?.destroy()
  editor = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('OutlinePanel', () => {
  it('shows an empty hint when there are no headings', () => {
    render(<OutlinePanel doc={doc(para('just text'))} editor={null} />)
    expect(screen.getByText('Add headings to see an outline.')).toBeInTheDocument()
  })

  it('lists headings with their level', () => {
    render(
      <OutlinePanel
        doc={doc(heading(1, 'Intro'), para('x'), heading(2, 'Part A'), heading(3, 'Detail'))}
        editor={null}
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons.map(b => [b.textContent, b.getAttribute('data-level')])).toEqual([
      ['Intro', '1'],
      ['Part A', '2'],
      ['Detail', '3'],
    ])
    expect(buttons[0]).toBeDisabled() // no editor yet
  })

  it('updates when the document changes', () => {
    const { rerender } = render(<OutlinePanel doc={doc(heading(1, 'One'))} editor={null} />)
    rerender(<OutlinePanel doc={doc(heading(1, 'One'), heading(2, 'Two'))} editor={null} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('clicking an entry selects the heading and scrolls it into view', () => {
    const content = doc(para('first'), heading(2, 'Target'), para('after')) as JSONContent
    editor = new Editor({ extensions: [StarterKit], content })
    const scroll = vi.fn()
    // jsdom has no layout; stand in for the heading element's scrollIntoView
    const dom = document.createElement('h2')
    dom.scrollIntoView = scroll
    vi.spyOn(editor.view, 'nodeDOM').mockReturnValue(dom)

    render(<OutlinePanel doc={editor.getJSON()} editor={editor} />)
    fireEvent.click(screen.getByRole('button', { name: 'Target' }))
    expect(editor.view.nodeDOM).toHaveBeenCalledWith(7) // "first" paragraph is 7 wide
    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    const sel = editor.state.selection
    expect(editor.state.doc.resolve(sel.from).parent.type.name).toBe('heading')
  })

  it('scrollToHeading tolerates a missing DOM node', () => {
    editor = new Editor({ extensions: [StarterKit], content: doc(heading(1, 'H')) as JSONContent })
    vi.spyOn(editor.view, 'nodeDOM').mockReturnValue(null)
    expect(() => scrollToHeading(editor!, 0)).not.toThrow()
  })
})

describe('BacklinksPanel', () => {
  const links = {
    outgoing: [
      { type: 'source', id: 'src1', title: 'Raft video' },
      { type: 'note', id: 'n2', title: 'Other page' },
    ],
    incoming: [{ id: 'n3', title: 'Linking page', icon: '📘' }],
  }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('loads and renders outgoing links and backlinks with correct hrefs', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, links))
    render(<BacklinksPanel spaceId="s1" noteId="n1" />)
    expect(screen.getByText('Loading links…')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Raft video/ })).toHaveAttribute(
      'href',
      '/dashboard/spaces/s1/sources/src1'
    )
    expect(screen.getByRole('link', { name: /Other page/ })).toHaveAttribute(
      'href',
      '/dashboard/spaces/s1/notes/n2'
    )
    expect(screen.getByRole('link', { name: /Linking page/ })).toHaveAttribute(
      'href',
      '/dashboard/spaces/s1/notes/n3'
    )
    expect(calls[0].url).toBe('/api/spaces/s1/notes/n1/links')
  })

  it('shows empty states', async () => {
    stubFetch(() => jsonResponse(200, { outgoing: [], incoming: [] }))
    render(<BacklinksPanel spaceId="s1" noteId="n1" />)
    expect(await screen.findByText('No captures or pages linked yet.')).toBeInTheDocument()
    expect(screen.getByText('No pages link here.')).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    stubFetch(() => jsonResponse(500, { error: { code: 'x', message: 'down' } }))
    render(<BacklinksPanel spaceId="s1" noteId="n1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load links.')
  })

  it('refetches when the page or refresh key changes, keeping old links meanwhile', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, links))
    const { rerender } = render(<BacklinksPanel spaceId="s1" noteId="n1" refreshKey="a" />)
    await screen.findByRole('link', { name: /Raft video/ })
    rerender(<BacklinksPanel spaceId="s1" noteId="n1" refreshKey="b" />)
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(screen.getByRole('link', { name: /Raft video/ })).toBeInTheDocument()
    rerender(<BacklinksPanel spaceId="s1" noteId="n9" refreshKey="b" />)
    await waitFor(() => expect(calls[2].url).toBe('/api/spaces/s1/notes/n9/links'))
  })
})
