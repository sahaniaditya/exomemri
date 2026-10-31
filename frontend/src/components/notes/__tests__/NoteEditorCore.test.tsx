import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import NoteEditorCore from '../NoteEditorCore'
import { NOTE_PICK_IMAGE_EVENT } from '../slash/items-basic'
import { installLayoutStubs, jsonResponse } from './jsdomStubs'

const scope = { kind: 'space' as const, spaceId: 's1' }
const DOC = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Loaded text' }] }],
}

let fetchMock: ReturnType<typeof vi.fn>

async function setup(content: Record<string, unknown> = DOC) {
  let editor: Editor | null = null
  const onChange = vi.fn()
  const onBlur = vi.fn()
  const onEditorReady = (instance: Editor | null) => {
    editor = instance
  }
  render(
    <NoteEditorCore
      scope={scope}
      initialContent={content}
      onChange={onChange}
      onBlur={onBlur}
      onEditorReady={onEditorReady}
    />
  )
  await screen.findByText('Loaded text')
  return { getEditor: () => editor as unknown as Editor, onChange, onBlur }
}

function imageFile(type = 'image/png', size = 100): File {
  return new File([new Uint8Array(size)], 'shot.png', { type })
}

beforeEach(() => {
  installLayoutStubs()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:fallback' }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('NoteEditorCore', () => {
  it('loads the document without reporting a change', async () => {
    const { onChange } = await setup()
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('reports user edits through onChange', async () => {
    const { getEditor, onChange } = await setup()
    act(() => {
      getEditor().commands.insertContent('more')
    })
    expect(onChange).toHaveBeenCalled()
  })

  it('reports blur', async () => {
    const { getEditor, onBlur } = await setup()
    act(() => {
      fireEvent.focus(getEditor().view.dom)
      fireEvent.blur(getEditor().view.dom)
    })
    expect(onBlur).toHaveBeenCalled()
  })

  it('re-mints signed urls for stored image keys while loading', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { url: 'https://signed.example/x.png' }))
    await setup({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Loaded text' }] },
        { type: 'image', attrs: { src: 'stale', key: 'notes/images/a.png' } },
      ],
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/spaces/s1/note-artifact-url?key=notes%2Fimages%2Fa.png'
    )
    await waitFor(() =>
      expect(document.querySelector('img')).toHaveAttribute('src', 'https://signed.example/x.png')
    )
  })

  it('toolbar buttons format the selection', async () => {
    const { getEditor } = await setup()
    act(() => {
      getEditor().commands.selectAll()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
    expect(getEditor().isActive('bold')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Code snippet' }))
    expect(getEditor().getJSON().content?.[0].type).toBe('codeBlock')
  })

  it('opens the file picker when the Image slash item fires its event', async () => {
    const { getEditor } = await setup()
    const click = vi.spyOn(screen.getByTestId('note-image-input'), 'click')
    act(() => {
      getEditor().view.dom.dispatchEvent(new CustomEvent(NOTE_PICK_IMAGE_EVENT))
    })
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('uploads a chosen image: mint, PUT to the signed url, then insert the node', async () => {
    const { getEditor, onChange } = await setup()
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          key: 'notes/images/new.png',
          upload_url: 'https://storage.example/upload',
          token: 't',
          path: 'p',
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse(200, { url: 'https://signed.example/new.png' }))

    const input = screen.getByTestId('note-image-input')
    await act(async () => {
      fireEvent.change(input, { target: { files: [imageFile()] } })
    })

    await waitFor(() =>
      expect(getEditor().getJSON().content?.some(n => n.type === 'image')).toBe(true)
    )
    const image = getEditor().getJSON().content?.find(n => n.type === 'image')
    expect(image?.attrs?.key).toBe('notes/images/new.png')
    expect(image?.attrs?.src).toBe('https://signed.example/new.png')

    const [mintUrl, mintInit] = fetchMock.mock.calls[0]
    expect(mintUrl).toBe('/api/spaces/s1/note-images')
    expect(JSON.parse((mintInit as RequestInit).body as string)).toEqual({
      content_type: 'image/png',
      filename: 'shot.png',
    })
    const [putUrl, putInit] = fetchMock.mock.calls[1]
    expect(putUrl).toBe('https://storage.example/upload')
    expect((putInit as RequestInit).method).toBe('PUT')
    expect((putInit as RequestInit).headers).toMatchObject({ 'x-upsert': 'true' })
    expect(onChange).toHaveBeenCalled()
  })

  it('rejects unsupported types and files over 5 MB without calling the server', async () => {
    await setup()
    const input = screen.getByTestId('note-image-input')
    await act(async () => {
      fireEvent.change(input, { target: { files: [imageFile('image/svg+xml')] } })
    })
    expect(await screen.findByText('Only image files are supported.')).toBeInTheDocument()

    await act(async () => {
      fireEvent.change(input, {
        target: { files: [imageFile('image/png', 5 * 1024 * 1024 + 1)] },
      })
    })
    expect(await screen.findByText('Image must be under 5 MB.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows a session message when minting the upload is unauthorised', async () => {
    await setup()
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: 'Unauthorized' }))
    await act(async () => {
      fireEvent.change(screen.getByTestId('note-image-input'), {
        target: { files: [imageFile()] },
      })
    })
    expect(await screen.findByText(/session has expired/i)).toBeInTheDocument()
  })

  it('shows a failure message when the storage upload fails', async () => {
    await setup()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, { key: 'notes/images/n.png', upload_url: 'https://s/u', token: 't', path: 'p' })
      )
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
    await act(async () => {
      fireEvent.change(screen.getByTestId('note-image-input'), {
        target: { files: [imageFile()] },
      })
    })
    expect(await screen.findByText('Image upload failed — try again.')).toBeInTheDocument()
  })
})
