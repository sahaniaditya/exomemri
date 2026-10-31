import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CoverUploadError,
  MAX_COVER_BYTES,
  resolveNoteImageUrl,
  uploadNoteImage,
} from './coverUpload'

afterEach(() => vi.unstubAllGlobals())

const file = (type = 'image/png', size = 4) => new File(['x'.repeat(size)], 'a.png', { type })

describe('uploadNoteImage', () => {
  it('mints, uploads with x-upsert and returns the key', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ key: 'notes/images/k.png', upload_url: 'https://s/u' })))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fn)
    const f = file()
    expect(await uploadNoteImage('s1', f)).toBe('notes/images/k.png')
    expect(fn.mock.calls[1][0]).toBe('https://s/u')
    expect(fn.mock.calls[1][1]).toMatchObject({
      method: 'PUT',
      headers: { 'x-upsert': 'true', 'content-type': 'image/png' },
      body: f,
    })
  })

  it.each([
    ['type', file('text/plain')],
    ['size', file('image/png', MAX_COVER_BYTES + 1)],
  ] as const)('rejects by %s before any request', async (kind, bad) => {
    const fn = vi.fn()
    vi.stubGlobal('fetch', fn)
    await expect(uploadNoteImage('s1', bad)).rejects.toMatchObject({ kind })
    expect(fn).not.toHaveBeenCalled()
  })

  it('classifies 401 and other failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}', { status: 401 })))
    await expect(uploadNoteImage('s1', file())).rejects.toMatchObject({ kind: 'session' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}', { status: 500 })))
    await expect(uploadNoteImage('s1', file())).rejects.toBeInstanceOf(CoverUploadError)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ key: 'k', upload_url: 'https://s/u' })))
        .mockResolvedValueOnce(new Response(null, { status: 403 }))
    )
    await expect(uploadNoteImage('s1', file())).rejects.toMatchObject({ kind: 'failed' })
  })
})

describe('resolveNoteImageUrl', () => {
  it('returns the signed url, or null on any failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://x' }))))
    expect(await resolveNoteImageUrl('s1', 'notes/images/a b.png')).toBe('https://x')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}', { status: 404 })))
    expect(await resolveNoteImageUrl('s1', 'k')).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('net')))
    expect(await resolveNoteImageUrl('s1', 'k')).toBeNull()
  })

  it('url-encodes the key', async () => {
    const fn = vi.fn().mockResolvedValueOnce(new Response('{}'))
    vi.stubGlobal('fetch', fn)
    await resolveNoteImageUrl('s1', 'notes/images/a b.png')
    expect(fn.mock.calls[0][0]).toBe(
      '/api/spaces/s1/note-artifact-url?key=notes%2Fimages%2Fa%20b.png'
    )
  })
})
