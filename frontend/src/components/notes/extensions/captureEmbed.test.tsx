import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Editor, type JSONContent } from '@tiptap/core'
import { EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { captureExtensions } from './captureExtensions'
import { formatTimestamp } from '../CaptureEmbedView'

const SRC = '11111111-1111-4111-8111-111111111111'
const NOTE = '22222222-2222-4222-8222-222222222222'

const embed = (attrs: Record<string, unknown> = {}) => ({
  type: 'captureEmbed',
  attrs: { sourceId: SRC, title: 'Intro to Raft', sourceType: 'youtube', timestampSec: null, ...attrs },
})

const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })

const makeEditor = (content: JSONContent) =>
  new Editor({ extensions: [StarterKit, ...captureExtensions({ spaceId: 's1' })], content })

let editor: Editor | null = null
afterEach(() => {
  cleanup()
  editor?.destroy()
  editor = null
  window.history.replaceState({}, '', '/')
})

describe('captureEmbed schema', () => {
  it('round-trips JSON with every attribute, including a timestamp', () => {
    const content = doc(
      { type: 'paragraph', content: [{ type: 'text', text: 'before' }] },
      embed({ timestampSec: 125 }),
      embed({ sourceId: NOTE, title: 'Article', sourceType: 'article', timestampSec: null })
    )
    editor = makeEditor(content)
    expect(editor.getJSON()).toEqual(content)
  })

  it('is an atom block: it has no content and sits at the top level', () => {
    editor = makeEditor(doc(embed()))
    const node = editor.state.doc.firstChild!
    expect(node.type.name).toBe('captureEmbed')
    expect(node.isAtom).toBe(true)
    expect(node.isBlock).toBe(true)
    expect(node.childCount).toBe(0)
  })

  it('defaults missing attributes', () => {
    editor = makeEditor(doc({ type: 'captureEmbed' }))
    expect(editor.getJSON().content![0].attrs).toEqual({
      sourceId: '',
      title: '',
      sourceType: '',
      timestampSec: null,
    })
  })

  it('survives an HTML round trip (copy / paste)', () => {
    const content = doc(embed({ timestampSec: 90 }))
    editor = makeEditor(content)
    const html = editor.getHTML()
    expect(html).toContain('data-capture-embed')
    expect(html).toContain(`data-source-id="${SRC}"`)
    expect(html).toContain('data-timestamp-sec="90"')
    const copy = makeEditor(doc({ type: 'paragraph' }))
    copy.commands.setContent(html)
    // (the editor may append its usual trailing empty paragraph after a block atom)
    expect(copy.getJSON().content![0]).toEqual(content.content![0])
    copy.destroy()
  })

  it('HTML without a timestamp parses back to null', () => {
    editor = makeEditor(doc(embed()))
    const html = editor.getHTML()
    expect(html).not.toContain('data-timestamp-sec')
    const copy = makeEditor(doc({ type: 'paragraph' }))
    copy.commands.setContent(html)
    expect(copy.getJSON().content![0].attrs!.timestampSec).toBeNull()
    copy.destroy()
  })

  it('can be inserted by command and deleted like any block', () => {
    editor = makeEditor(doc({ type: 'paragraph' }))
    editor.chain().insertContentAt(0, embed()).run()
    expect(editor.getJSON().content!.map(n => n.type)).toContain('captureEmbed')
    editor.commands.setNodeSelection(0)
    editor.commands.deleteSelection()
    expect(editor.getJSON().content!.map(n => n.type)).not.toContain('captureEmbed')
  })
})

describe('captureEmbed node view', () => {
  function mount(content: JSONContent) {
    window.history.replaceState({}, '', '/dashboard/spaces/s1/notes/n9')
    editor = makeEditor(content)
    render(<EditorContent editor={editor} />)
  }

  it('renders a card with the title, type and a link to the capture', async () => {
    mount(doc(embed()))
    const link = await screen.findByRole('link', { name: 'Open capture Intro to Raft' })
    expect(link).toHaveAttribute('href', '/dashboard/spaces/s1/sources/' + SRC)
    expect(link).toHaveTextContent('Intro to Raft')
    expect(link).toHaveTextContent('youtube')
    expect(screen.queryByRole('link', { name: /Open at/ })).not.toBeInTheDocument()
  })

  it('shows a timestamp chip that opens the capture at that time', async () => {
    mount(doc(embed({ timestampSec: 3725 })))
    const chip = await screen.findByRole('link', { name: 'Open at 1:02:05' })
    expect(chip).toHaveTextContent('1:02:05')
    expect(chip).toHaveAttribute('href', `/dashboard/spaces/s1/sources/${SRC}?t=3725`)
  })

  it('falls back to a placeholder title', async () => {
    mount(doc(embed({ title: '' })))
    expect(await screen.findByText('Untitled capture')).toBeInTheDocument()
  })

  it('formats timestamps', () => {
    expect(formatTimestamp(0)).toBe('0:00')
    expect(formatTimestamp(65)).toBe('1:05')
    expect(formatTimestamp(3600)).toBe('1:00:00')
    expect(formatTimestamp(-4)).toBe('0:00')
    expect(formatTimestamp(61.9)).toBe('1:01')
  })
})

describe('mention nodes', () => {
  it('round-trip JSON as inline atoms', () => {
    const content = doc({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'see ' },
        { type: 'noteMention', attrs: { noteId: NOTE, title: 'Other page' } },
        { type: 'text', text: ' and ' },
        { type: 'sourceMention', attrs: { sourceId: SRC, title: 'Raft video' } },
      ],
    })
    editor = makeEditor(content)
    expect(editor.getJSON()).toEqual(content)
    const para = editor.state.doc.firstChild!
    expect(para.child(1).isAtom).toBe(true)
    expect(para.child(1).isInline).toBe(true)
  })

  it('survive an HTML round trip', () => {
    const content = doc({
      type: 'paragraph',
      content: [
        { type: 'noteMention', attrs: { noteId: NOTE, title: 'Other page' } },
        { type: 'sourceMention', attrs: { sourceId: SRC, title: 'Raft video' } },
      ],
    })
    editor = makeEditor(content)
    const html = editor.getHTML()
    const copy = makeEditor(doc({ type: 'paragraph' }))
    copy.commands.setContent(html)
    expect(copy.getJSON()).toEqual(content)
    copy.destroy()
  })

  it('render as links to the page and the capture', async () => {
    window.history.replaceState({}, '', '/dashboard/spaces/s1/notes/n9')
    editor = makeEditor(
      doc({
        type: 'paragraph',
        content: [
          { type: 'noteMention', attrs: { noteId: NOTE, title: 'Other page' } },
          { type: 'sourceMention', attrs: { sourceId: SRC, title: 'Raft video' } },
        ],
      })
    )
    render(<EditorContent editor={editor} />)
    expect(await screen.findByRole('link', { name: 'Other page' })).toHaveAttribute(
      'href',
      `/dashboard/spaces/s1/notes/${NOTE}`
    )
    expect(screen.getByRole('link', { name: /Raft video/ })).toHaveAttribute(
      'href',
      `/dashboard/spaces/s1/sources/${SRC}`
    )
  })
})

describe('captureExtensions', () => {
  it('registers the embed, both mentions and the @ suggestion', () => {
    const names = captureExtensions().map(ext => ext.name)
    expect(names).toEqual(['captureEmbed', 'noteMention', 'sourceMention', 'mentionSuggestion'])
  })
})
