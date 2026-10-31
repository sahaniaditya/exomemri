import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import NoteHeaderMeta from './NoteHeaderMeta'
import { jsonResponse, pageFor, stubFetch } from './testUtils'

const onSaved = vi.fn()

function ui(props: Partial<React.ComponentProps<typeof NoteHeaderMeta>> = {}) {
  return (
    <NoteHeaderMeta
      spaceId="s1"
      noteId="n1"
      icon={null}
      coverKey={null}
      fullWidth={false}
      onSaved={onSaved}
      {...props}
    />
  )
}

const png = (size = 10, type = 'image/png') => {
  const file = new File(['x'.repeat(size)], 'cover.png', { type })
  return file
}

beforeEach(() => {
  onSaved.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('NoteHeaderMeta icon', () => {
  it('opens the emoji grid and saves the chosen icon', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, pageFor('n1', { icon: '🔥' })))
    render(ui())
    expect(screen.queryByRole('dialog', { name: 'Choose an icon' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change icon' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use 🔥 as icon' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(calls[0]).toEqual({
      url: '/api/spaces/s1/notes/pages/n1',
      method: 'PATCH',
      body: { icon: '🔥' },
    })
    expect(onSaved.mock.calls[0][0]).toMatchObject({ icon: '🔥' })
    expect(screen.getByRole('button', { name: 'Change icon' })).toHaveTextContent('🔥')
    expect(screen.queryByRole('dialog', { name: 'Choose an icon' })).not.toBeInTheDocument()
  })

  it('removes the icon', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, pageFor('n1', { icon: null })))
    render(ui({ icon: '📘' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove icon' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toEqual({ icon: null })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove icon' })).not.toBeInTheDocument())
  })

  it('shows an error and keeps the old icon when the save fails', async () => {
    stubFetch(() => jsonResponse(500, { error: { code: 'x', message: 'no' } }))
    render(ui({ icon: '📘' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change icon' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use 🔥 as icon' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not change the icon.')
    expect(screen.getByRole('button', { name: 'Change icon' })).toHaveTextContent('📘')
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('follows new props from the parent', () => {
    const { rerender } = render(ui({ icon: '📘' }))
    rerender(ui({ icon: '🚀' }))
    expect(screen.getByRole('button', { name: 'Change icon' })).toHaveTextContent('🚀')
  })
})

describe('NoteHeaderMeta full width', () => {
  it('saves the toggle', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, pageFor('n1', { full_width: true })))
    render(ui())
    const box = screen.getByRole('checkbox', { name: 'Full width' })
    expect(box).not.toBeChecked()
    fireEvent.click(box)
    await waitFor(() => expect(box).toBeChecked())
    expect(calls[0].body).toEqual({ full_width: true })
    expect(onSaved.mock.calls[0][0]).toMatchObject({ full_width: true })
  })

  it('reflects the saved value and can be switched back off', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, pageFor('n1', { full_width: false })))
    render(ui({ fullWidth: true }))
    const box = screen.getByRole('checkbox', { name: 'Full width' })
    expect(box).toBeChecked()
    fireEvent.click(box)
    await waitFor(() => expect(box).not.toBeChecked())
    expect(calls[0].body).toEqual({ full_width: false })
  })
})

describe('NoteHeaderMeta cover', () => {
  it('uploads a cover: mint, PUT bytes to storage, then save the key', async () => {
    const { calls } = stubFetch(({ url, method }) => {
      if (url === '/api/spaces/s1/note-images') {
        return jsonResponse(200, {
          key: 'notes/images/abc.png',
          upload_url: 'https://storage.example/upload?token=t',
          token: 't',
          path: 'p',
        })
      }
      if (url.startsWith('https://storage.example')) return jsonResponse(200, {})
      if (method === 'PATCH') return jsonResponse(200, pageFor('n1', { cover_key: 'notes/images/abc.png' }))
      if (url.startsWith('/api/spaces/s1/note-artifact-url')) {
        return jsonResponse(200, { url: 'https://signed.example/abc.png', expires_in: 60 })
      }
      return jsonResponse(404)
    })
    render(ui())
    const file = png()
    fireEvent.change(screen.getByLabelText('Add cover image'), { target: { files: [file] } })
    await waitFor(() => expect(onSaved).toHaveBeenCalled())

    expect(calls[0]).toMatchObject({ url: '/api/spaces/s1/note-images', method: 'POST' })
    expect(calls[0].body).toEqual({ content_type: 'image/png', filename: 'cover.png' })
    expect(calls[1]).toMatchObject({ url: 'https://storage.example/upload?token=t', method: 'PUT' })
    expect(calls[1].body).toBe(file)
    expect(calls[2]).toEqual({
      url: '/api/spaces/s1/notes/pages/n1',
      method: 'PATCH',
      body: { cover_key: 'notes/images/abc.png' },
    })
    const img = await waitFor(() => {
      const el = screen.getByTestId('cover').querySelector('img')
      expect(el).not.toBeNull()
      return el!
    })
    expect(img).toHaveAttribute('src', 'https://signed.example/abc.png')
    expect(screen.queryByLabelText('Add cover image')).not.toBeInTheDocument()
  })

  it.each([
    ['unsupported type', png(10, 'application/pdf'), /Only JPEG/],
    ['oversized file', png(5 * 1024 * 1024 + 1), /under 5 MB/],
  ])('rejects %s without any request', async (_name, file, message) => {
    const { calls } = stubFetch(() => jsonResponse(200, {}))
    render(ui())
    fireEvent.change(screen.getByLabelText('Add cover image'), { target: { files: [file] } })
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(calls).toHaveLength(0)
  })

  it('reports an upload failure and does not save a cover', async () => {
    const { calls } = stubFetch(({ url }) =>
      url === '/api/spaces/s1/note-images'
        ? jsonResponse(200, { key: 'notes/images/a.png', upload_url: 'https://s.example/u' })
        : jsonResponse(500)
    )
    render(ui())
    fireEvent.change(screen.getByLabelText('Add cover image'), { target: { files: [png()] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Image upload failed')
    expect(calls.some(c => c.method === 'PATCH')).toBe(false)
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('tells the user when their session expired', async () => {
    stubFetch(() => jsonResponse(401, { detail: 'Unauthorized' }))
    render(ui())
    fireEvent.change(screen.getByLabelText('Add cover image'), { target: { files: [png()] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('session has expired')
  })

  it('removes an existing cover', async () => {
    const { calls } = stubFetch(({ url, method }) => {
      if (method === 'PATCH') return jsonResponse(200, pageFor('n1', { cover_key: null }))
      if (url.includes('note-artifact-url')) return jsonResponse(200, { url: 'https://signed.example/x.png' })
      return jsonResponse(404)
    })
    render(ui({ coverKey: 'notes/images/x.png' }))
    expect(await screen.findByTestId('cover')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove cover' }))
    await waitFor(() => expect(screen.queryByTestId('cover')).not.toBeInTheDocument())
    expect(calls.find(c => c.method === 'PATCH')!.body).toEqual({ cover_key: null })
    expect(screen.getByLabelText('Add cover image')).toBeInTheDocument()
  })

  it('still renders when the signed URL cannot be fetched', async () => {
    stubFetch(() => jsonResponse(500))
    render(ui({ coverKey: 'notes/images/x.png' }))
    expect(await screen.findByTestId('cover')).toBeInTheDocument()
    expect(screen.getByTestId('cover').querySelector('img')).toBeNull()
  })
})
