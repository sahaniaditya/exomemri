/**
 * The notes BFF routes are thin proxies: token from the cookie, forward to the
 * backend endpoint, pass status and body through. Exercised against a mocked
 * `apiFetch` and cookie store.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiFetch = vi.fn()
let token: string | undefined = 'tok'

vi.mock('@/lib/api', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'atlas_token' && token ? { value: token } : undefined),
  }),
}))

import * as tree from './[spaceId]/notes/tree/route'
import * as trash from './[spaceId]/notes/trash/route'
import * as trashItem from './[spaceId]/notes/trash/[noteId]/route'
import * as search from './[spaceId]/notes/search/route'
import * as pages from './[spaceId]/notes/pages/route'
import * as page from './[spaceId]/notes/pages/[noteId]/route'
import * as trashOne from './[spaceId]/notes/[noteId]/trash/route'
import * as restore from './[spaceId]/notes/[noteId]/restore/route'
import * as duplicate from './[spaceId]/notes/[noteId]/duplicate/route'
import * as exportMd from './[spaceId]/notes/[noteId]/export/route'
import * as links from './[spaceId]/notes/[noteId]/links/route'
import * as sources from './[spaceId]/sources/route'

const S = 'space-1'
const N = 'note-1'
const space = { params: Promise.resolve({ spaceId: S }) }
const note = { params: Promise.resolve({ spaceId: S, noteId: N }) }
const req = (url = 'http://x/api', init?: RequestInit) => new Request(url, init)
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

type Case = {
  name: string
  call: () => Promise<Response>
  endpoint: string
  method: string
  body?: unknown
}

const cases: Case[] = [
  { name: 'tree', call: () => tree.GET(req(), space), endpoint: `/v1/spaces/${S}/notes/tree`, method: 'GET' },
  { name: 'trash list', call: () => trash.GET(req(), space), endpoint: `/v1/spaces/${S}/notes/trash`, method: 'GET' },
  { name: 'trash delete', call: () => trashItem.DELETE(req(), note), endpoint: `/v1/spaces/${S}/notes/trash/${N}`, method: 'DELETE' },
  { name: 'search', call: () => search.GET(req('http://x/api?q=a%20b%26c'), space), endpoint: `/v1/spaces/${S}/notes/search?q=a%20b%26c`, method: 'GET' },
  { name: 'create page', call: () => pages.POST(req('http://x', { method: 'POST', body: JSON.stringify({ title: 'T', parent_id: 'p' }) }), space), endpoint: `/v1/spaces/${S}/notes/pages`, method: 'POST', body: { title: 'T', parent_id: 'p' } },
  { name: 'get page', call: () => page.GET(req(), note), endpoint: `/v1/spaces/${S}/notes/${N}`, method: 'GET' },
  { name: 'patch page', call: () => page.PATCH(req('http://x', { method: 'PATCH', body: JSON.stringify({ icon: '📘' }) }), note), endpoint: `/v1/spaces/${S}/notes/${N}`, method: 'PATCH', body: { icon: '📘' } },
  { name: 'trash page', call: () => trashOne.POST(req(), note), endpoint: `/v1/spaces/${S}/notes/${N}/trash`, method: 'POST' },
  { name: 'restore', call: () => restore.POST(req(), note), endpoint: `/v1/spaces/${S}/notes/${N}/restore`, method: 'POST' },
  { name: 'duplicate', call: () => duplicate.POST(req(), note), endpoint: `/v1/spaces/${S}/notes/${N}/duplicate`, method: 'POST' },
  { name: 'export', call: () => exportMd.GET(req(), note), endpoint: `/v1/spaces/${S}/notes/${N}/export.md`, method: 'GET' },
  { name: 'links', call: () => links.GET(req(), note), endpoint: `/v1/spaces/${S}/notes/${N}/links`, method: 'GET' },
  { name: 'captures', call: () => sources.GET(req(), space), endpoint: `/v1/spaces/${S}/sources?limit=100`, method: 'GET' },
]

beforeEach(() => {
  apiFetch.mockReset()
  token = 'tok'
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe.each(cases)('$name', ({ call, endpoint, method, body }) => {
  it('forwards to the backend with the cookie token and passes status + body through', async () => {
    apiFetch.mockResolvedValueOnce(json(200, { ok: 1 }))
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: 1 })
    const [url, init, tokenArg] = apiFetch.mock.calls[0]
    expect(url).toBe(endpoint)
    expect(init.method).toBe(method)
    expect(tokenArg).toBe('tok')
    if (body === undefined) expect(init.body).toBeUndefined()
    else expect(JSON.parse(init.body)).toEqual(body)
  })

  it('returns 401 without calling the backend when there is no cookie', async () => {
    token = undefined
    const res = await call()
    expect(res.status).toBe(401)
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('passes backend error status and envelope through', async () => {
    apiFetch.mockResolvedValueOnce(json(409, { error: { code: 'conflict', message: 'no' } }))
    const res = await call()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: { code: 'conflict', message: 'no' } })
  })

  it('answers 502 when the backend is unreachable', async () => {
    apiFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const res = await call()
    expect(res.status).toBe(502)
  })
})

describe('204 responses', () => {
  it('trash page relays an empty 204', async () => {
    apiFetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    const res = await trashOne.POST(req(), note)
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
  })

  it('delete forever relays an empty 204', async () => {
    apiFetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    expect((await trashItem.DELETE(req(), note)).status).toBe(204)
  })
})

describe('markdown export', () => {
  it('keeps content-type and content-disposition and the raw body', async () => {
    apiFetch.mockResolvedValueOnce(
      new Response('# Hi\n', {
        status: 200,
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'content-disposition': 'attachment; filename="hi.md"',
        },
      })
    )
    const res = await exportMd.GET(req(), note)
    expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="hi.md"')
    expect(await res.text()).toBe('# Hi\n')
  })

  it('relays a JSON error from the export endpoint', async () => {
    apiFetch.mockResolvedValueOnce(json(404, { error: { code: 'not_found', message: 'x' } }))
    const res = await exportMd.GET(req(), note)
    expect(res.status).toBe(404)
  })
})

describe('request bodies', () => {
  it.each([
    ['create page', () => pages.POST(req('http://x', { method: 'POST', body: '{nope' }), space)],
    ['patch page', () => page.PATCH(req('http://x', { method: 'PATCH', body: '' }), note)],
  ])('%s rejects malformed JSON with 400 and never calls the backend', async (_n, call) => {
    const res = await call()
    expect(res.status).toBe(400)
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('search with no q still forwards an empty query (backend returns 422)', async () => {
    apiFetch.mockResolvedValueOnce(json(422, { error: { code: 'validation', message: 'q' } }))
    const res = await search.GET(req('http://x/api'), space)
    expect(apiFetch.mock.calls[0][0]).toBe(`/v1/spaces/${S}/notes/search?q=`)
    expect(res.status).toBe(422)
  })
})
