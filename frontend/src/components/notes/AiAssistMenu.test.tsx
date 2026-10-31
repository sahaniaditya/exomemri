import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import { AI_ASSIST_EVENT, type AssistAction } from '@/lib/notes/aiAssist'
import AiAssistMenu from './AiAssistMenu'

let editor: Editor

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function docText(): string {
  return editor.state.doc.textBetween(0, editor.state.doc.content.size, '|', ' ')
}

function trigger(action: AssistAction) {
  act(() => {
    window.dispatchEvent(new CustomEvent(AI_ASSIST_EVENT, { detail: { action } }))
  })
}

function bodyOf(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
  return JSON.parse(fetchMock.mock.calls[call][1].body)
}

beforeEach(() => {
  editor = new Editor({
    extensions: [StarterKit],
    content: '<p>Alpha beta gamma</p><p>Second paragraph</p>',
  })
  editor.commands.setTextSelection({ from: 1, to: 6 }) // "Alpha"
  render(<AiAssistMenu editor={editor} spaceId="s1" noteId="n1" />)
})

afterEach(() => {
  cleanup()
  editor.destroy()
  vi.unstubAllGlobals()
})

describe('AiAssistMenu', () => {
  it('sends the selection, shows a preview, and writes nothing until accepted', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ text: 'A summary' }))
    vi.stubGlobal('fetch', fetchMock)
    const before = docText()

    trigger('summarize')
    expect(await screen.findByText('A summary')).toBeInTheDocument()

    expect(bodyOf(fetchMock)).toEqual({
      action: 'summarize',
      text: 'Alpha',
      note_id: 'n1',
    })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/spaces/s1/notes/ai')
    expect(docText()).toBe(before)
  })

  it('Insert below adds paragraphs after the block and closes the card', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ text: 'New one\n\nNew two' })))
    trigger('summarize')
    fireEvent.click(await screen.findByRole('button', { name: 'Insert below' }))
    expect(docText()).toBe('Alpha beta gamma|New one|New two|Second paragraph')
    expect(screen.queryByLabelText('AI result')).toBeNull()
  })

  it('Replace selection swaps only the selected text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ text: 'Omega' })))
    trigger('rewrite')
    fireEvent.click(await screen.findByRole('button', { name: 'Replace selection' }))
    expect(docText()).toBe('Omega beta gamma|Second paragraph')
  })

  it('Discard closes without touching the document', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ text: 'Result' })))
    const before = docText()
    trigger('summarize')
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }))
    expect(screen.queryByText('Result')).toBeNull()
    expect(docText()).toBe(before)
  })

  it('Try again re-runs the same request and shows the new result', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ text: 'first' }))
      .mockResolvedValueOnce(json({ text: 'second' }))
    vi.stubGlobal('fetch', fetchMock)
    trigger('expand')
    await screen.findByText('first')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('second')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(bodyOf(fetchMock, 1)).toEqual(bodyOf(fetchMock, 0))
  })

  it('Cancel aborts the in-flight request and writes nothing', async () => {
    let signal: AbortSignal | undefined
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal
      return new Promise<Response>((_resolve, reject) => {
        signal!.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        )
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const before = docText()
    trigger('summarize')
    expect(await screen.findByText('Working on it…')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(signal?.aborted).toBe(true))
    expect(screen.queryByText('Working on it…')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(docText()).toBe(before)
  })

  it('Ask asks for a question first, then sends it as the instruction', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ text: 'Because.' }))
    vi.stubGlobal('fetch', fetchMock)
    trigger('ask')
    expect(fetchMock).not.toHaveBeenCalled()
    const input = await screen.findByLabelText('What do you want to ask?')
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled()
    fireEvent.change(input, { target: { value: 'Why?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText('Because.')).toBeInTheDocument()
    expect(bodyOf(fetchMock)).toEqual({
      action: 'ask',
      text: 'Alpha',
      instruction: 'Why?',
      note_id: 'n1',
    })
  })

  it('offers the selection actions only while text is selected', () => {
    expect(screen.getByRole('toolbar', { name: 'AI assist' })).toBeInTheDocument()
    act(() => {
      editor.commands.setTextSelection(3)
    })
    expect(screen.queryByRole('toolbar', { name: 'AI assist' })).toBeNull()
  })

  it('toolbar buttons start the matching action', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ text: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }))
    await screen.findByText('ok')
    expect(bodyOf(fetchMock).action).toBe('expand')
  })

  it('continue without a selection uses the whole note and has no Replace', async () => {
    act(() => {
      editor.commands.setTextSelection(3)
    })
    const fetchMock = vi.fn().mockResolvedValue(json({ text: 'More text' }))
    vi.stubGlobal('fetch', fetchMock)
    trigger('continue')
    await screen.findByText('More text')
    expect(bodyOf(fetchMock).text).toBe('Alpha beta gamma\n\nSecond paragraph')
    expect(screen.queryByRole('button', { name: 'Replace selection' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Insert below' }))
    expect(docText().endsWith('Second paragraph|More text')).toBe(true)
  })

  it('explains an empty note instead of calling the server', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    act(() => {
      editor.commands.setContent('<p></p>')
    })
    trigger('summarize')
    expect(screen.getByRole('alert')).toHaveTextContent('Nothing to work on yet')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('402 shows the credits message with a link and no retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: {} }, 402)))
    trigger('summarize')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("You're out of credits")
    expect(screen.getByRole('link', { name: 'See your credits' })).toHaveAttribute(
      'href',
      '/dashboard'
    )
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('429 shows the rate-limit message and allows retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: {} }, 429)))
    trigger('summarize')
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many AI requests')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('500 and network failures show plain messages and leave the doc alone', async () => {
    const before = docText()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 500)))
    trigger('summarize')
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    trigger('summarize')
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't reach the server")
    expect(docText()).toBe(before)
  })

  it('does nothing without an editor', () => {
    cleanup()
    render(<AiAssistMenu editor={null} spaceId="s1" />)
    trigger('summarize')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
