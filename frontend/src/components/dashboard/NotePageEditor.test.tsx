import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import NotePageEditor from './NotePageEditor'
import { installLayoutStubs } from '@/components/notes/__tests__/jsdomStubs'

// Smoke tests for the legacy capture-notes editor: its helper imports (now in
// lib/notes/editor-utils) resolve and the editor behaves as before.
const DOC = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Capture note body' }] },
    { type: 'codeBlock', attrs: { language: null }, content: [{ type: 'text', text: 'x = 1' }] },
  ],
}

beforeEach(() => {
  installLayoutStubs()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('NotePageEditor (legacy capture notes)', () => {
  it('renders the toolbar, the saved document and a Save button', async () => {
    render(
      <NotePageEditor
        scope={{ kind: 'source', sourceId: 'src1' }}
        pageId="p1"
        initialContent={DOC}
        savedContent={DOC}
        savedAt={null}
        editable
        onDraft={() => {}}
        onSaved={() => {}}
      />
    )
    expect(await screen.findByText('Capture note body')).toBeInTheDocument()
    expect(screen.getByText('x = 1')).toBeInTheDocument()
    for (const name of ['Bold', 'Italic', 'Add link', 'Inline code', 'Code snippet', 'Add emoji', 'Upload image']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    // Note: the legacy editor marks itself dirty after load (tiptap 3 emits `update` from
    // setEditable). That is existing behaviour and is intentionally left untouched.
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('opens the emoji panel from the shared position helper', async () => {
    render(
      <NotePageEditor
        scope={{ kind: 'source', sourceId: 'src1' }}
        pageId="p1"
        initialContent={DOC}
        savedContent={DOC}
        savedAt="2026-10-31T10:00:00Z"
        editable
        onDraft={() => {}}
        onSaved={() => {}}
      />
    )
    await screen.findByText('Capture note body')
    fireEvent.click(screen.getByRole('button', { name: 'Add emoji' }))
    expect(screen.getByRole('listbox', { name: 'Emojis' })).toBeInTheDocument()
    expect(screen.getByText('✨')).toBeInTheDocument()
  })

  it('does not enable slash commands or headings (behaviour unchanged)', async () => {
    render(
      <NotePageEditor
        scope={{ kind: 'source', sourceId: 'src1' }}
        pageId="p1"
        initialContent={DOC}
        savedContent={DOC}
        savedAt={null}
        editable
        onDraft={() => {}}
        onSaved={() => {}}
      />
    )
    await screen.findByText('Capture note body')
    expect(document.querySelector('h1,h2,h3')).toBeNull()
    expect(screen.queryByRole('listbox', { name: 'Insert block' })).not.toBeInTheDocument()
  })
})
