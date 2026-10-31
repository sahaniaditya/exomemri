import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import NoteDocPreview from './NoteDocPreview'

afterEach(cleanup)

const text = (t: string, marks?: Array<Record<string, unknown>>) => ({ type: 'text', text: t, marks })

describe('NoteDocPreview', () => {
  it('renders blocks and marks', () => {
    render(
      <NoteDocPreview
        content={{
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [text('Title')] },
            { type: 'paragraph', content: [text('plain '), text('bold', [{ type: 'bold' }])] },
            {
              type: 'bulletList',
              content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('item')] }] }],
            },
            { type: 'codeBlock', content: [text('let x = 1')] },
            { type: 'blockquote', content: [{ type: 'paragraph', content: [text('quoted')] }] },
          ],
        }}
      />
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeInTheDocument()
    expect(screen.getByText('bold').closest('strong')).not.toBeNull()
    expect(screen.getByRole('listitem')).toHaveTextContent('item')
    expect(screen.getByText('let x = 1').tagName).toBe('CODE')
    expect(screen.getByText('quoted').closest('blockquote')).not.toBeNull()
  })

  it('never injects HTML and drops unsafe links', () => {
    render(
      <NoteDocPreview
        content={{
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                text('<img src=x onerror=alert(1)>'),
                text('bad', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]),
                text('good', [{ type: 'link', attrs: { href: 'https://example.com' } }]),
              ],
            },
          ],
        }}
      />
    )
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(screen.getByText('bad').closest('a')).toBeNull()
    expect(screen.getByText('good').closest('a')).toHaveAttribute('href', 'https://example.com')
  })

  it('degrades unknown nodes to their children and tolerates junk', () => {
    render(
      <NoteDocPreview
        content={{
          type: 'doc',
          content: [
            { type: 'callout', content: [{ type: 'paragraph', content: [text('inside callout')] }] },
            { type: 'mystery' },
            { type: 'image', attrs: { key: 'k' } },
          ],
        }}
      />
    )
    expect(screen.getByText('inside callout')).toBeInTheDocument()
    expect(screen.getByText('[image]')).toBeInTheDocument()
  })

  it('shows an empty message for an empty doc or non-doc content', () => {
    render(<NoteDocPreview content={{}} />)
    expect(screen.getByText('This version is empty.')).toBeInTheDocument()
  })
})
