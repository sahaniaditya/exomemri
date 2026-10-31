import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  NotesApiError,
  createPage,
  deleteForever,
  exportMarkdownUrl,
  fetchLinks,
  fetchPage,
  fetchTrash,
  fetchTree,
  patchPage,
  restorePage,
  searchNotes,
  trashPage,
  duplicatePage,
} from './client'

const reply = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status })

function mockFetch(...responses: Response[]) {
  const fn = vi.fn()
  responses.forEach(r => fn.mockResolvedValueOnce(r))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('notes client', () => {
  it('fetchTree unwraps items and hits the BFF', async () => {
    const fn = mockFetch(reply(200, { items: [{ id: 'a' }] }))
    expect(await fetchTree('s1')).toEqual([{ id: 'a' }])
    expect(fn).toHaveBeenCalledWith('/api/spaces/s1/notes/tree', undefined)
  })

  it('createPage posts JSON to /pages', async () => {
    const fn = mockFetch(reply(201, { id: 'n' }))
    await createPage('s1', { title: 'T', parent_id: 'p' })
    const [url, init] = fn.mock.calls[0]
    expect(url).toBe('/api/spaces/s1/notes/pages')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ title: 'T', parent_id: 'p' })
  })

  it('patchPage / fetchPage use the pages path', async () => {
    const fn = mockFetch(reply(200, { id: 'n' }), reply(200, { id: 'n' }))
    await patchPage('s1', 'n', { icon: '📘', expected_updated_at: 'x' })
    await fetchPage('s1', 'n')
    expect(fn.mock.calls[0][0]).toBe('/api/spaces/s1/notes/pages/n')
    expect(fn.mock.calls[0][1].method).toBe('PATCH')
    expect(JSON.parse(fn.mock.calls[0][1].body)).toEqual({ icon: '📘', expected_updated_at: 'x' })
    expect(fn.mock.calls[1][0]).toBe('/api/spaces/s1/notes/pages/n')
  })

  it('trash, restore, duplicate, delete forever hit the right routes', async () => {
    const fn = mockFetch(reply(204), reply(200, {}), reply(201, {}), reply(204))
    await trashPage('s1', 'n')
    await restorePage('s1', 'n')
    await duplicatePage('s1', 'n')
    await deleteForever('s1', 'n')
    expect(fn.mock.calls.map(c => [c[0], c[1].method])).toEqual([
      ['/api/spaces/s1/notes/n/trash', 'POST'],
      ['/api/spaces/s1/notes/n/restore', 'POST'],
      ['/api/spaces/s1/notes/n/duplicate', 'POST'],
      ['/api/spaces/s1/notes/trash/n', 'DELETE'],
    ])
  })

  it('204 resolves to undefined', async () => {
    mockFetch(reply(204))
    await expect(trashPage('s1', 'n')).resolves.toBeUndefined()
  })

  it('fetchTrash and fetchLinks', async () => {
    mockFetch(reply(200, { items: [{ id: 't' }] }), reply(200, { outgoing: [], incoming: [] }))
    expect(await fetchTrash('s1')).toEqual([{ id: 't' }])
    expect(await fetchLinks('s1', 'n')).toEqual({ outgoing: [], incoming: [] })
  })

  it('searchNotes encodes and truncates the query', async () => {
    const fn = mockFetch(reply(200, { items: [] }))
    const ctrl = new AbortController()
    await searchNotes('s1', '  a&b c  ', ctrl.signal)
    expect(fn.mock.calls[0][0]).toBe('/api/spaces/s1/notes/search?q=a%26b%20c')
    expect(fn.mock.calls[0][1].signal).toBe(ctrl.signal)
    mockFetch(reply(200, { items: [] }))
    await searchNotes('s1', 'x'.repeat(150))
    expect(
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0].length
    ).toBe('/api/spaces/s1/notes/search?q='.length + 100)
  })

  it('maps the backend error envelope to NotesApiError', async () => {
    mockFetch(reply(409, { error: { code: 'conflict', message: 'Changed elsewhere.' } }))
    const err = await patchPage('s1', 'n', { title: 'x' }).catch(e => e)
    expect(err).toBeInstanceOf(NotesApiError)
    expect(err).toMatchObject({ status: 409, code: 'conflict', message: 'Changed elsewhere.' })
    expect(err.isConflict).toBe(true)
  })

  it('falls back to detail strings and generic messages', async () => {
    mockFetch(reply(401, { detail: 'Unauthorized' }), new Response('<html>', { status: 500 }))
    expect(await fetchTree('s1').catch(e => e)).toMatchObject({ status: 401, message: 'Unauthorized' })
    expect(await fetchTree('s1').catch(e => e)).toMatchObject({
      status: 500,
      message: 'Request failed (500)',
    })
  })

  it('exportMarkdownUrl', () => {
    expect(exportMarkdownUrl('s1', 'n')).toBe('/api/spaces/s1/notes/n/export')
  })
})
