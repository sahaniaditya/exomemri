import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const cookieGet = vi.fn()
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }))

const apiFetch = vi.fn()
vi.mock('@/lib/api', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }))

import { POST as aiPost } from '../../app/api/spaces/[spaceId]/notes/ai/route'
import {
  GET as listGet,
  POST as createPost,
} from '../../app/api/spaces/[spaceId]/notes/[noteId]/versions/route'
import { GET as oneGet } from '../../app/api/spaces/[spaceId]/notes/[noteId]/versions/[versionId]/route'
import { POST as restorePost } from '../../app/api/spaces/[spaceId]/notes/[noteId]/versions/[versionId]/restore/route'

function req(body?: string): NextRequest {
  return { text: async () => body ?? '' } as unknown as NextRequest
}
const ctx = (extra: Record<string, string> = {}) => ({
  params: Promise.resolve({ spaceId: 's1', noteId: 'n1', versionId: 'v1', ...extra }),
})
function backend(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status })
}

beforeEach(() => {
  vi.clearAllMocks()
  cookieGet.mockReturnValue({ value: 'tok' })
})

describe('notes BFF routes', () => {
  it('AI: forwards body with the cookie token and passes status/body through', async () => {
    apiFetch.mockResolvedValue(backend(200, { text: 'hi' }))
    const body = JSON.stringify({ action: 'summarize', text: 't' })
    const res = await aiPost(req(body), ctx())
    expect(apiFetch).toHaveBeenCalledWith(
      '/v1/spaces/s1/notes/ai',
      { method: 'POST', body },
      'tok'
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'hi' })
  })

  it.each([402, 429, 500, 404, 422])('AI: relays backend status %s and error body', async status => {
    const err = { error: { code: 'x', message: 'm' } }
    apiFetch.mockResolvedValue(backend(status, err))
    const res = await aiPost(req('{}'), ctx())
    expect(res.status).toBe(status)
    expect(await res.json()).toEqual(err)
  })

  it('returns 401 without calling the backend when there is no cookie', async () => {
    cookieGet.mockReturnValue(undefined)
    for (const call of [
      () => aiPost(req('{}'), ctx()),
      () => listGet(req(), ctx()),
      () => createPost(req('{}'), ctx()),
      () => oneGet(req(), ctx({ versionId: 'v1' })),
      () => restorePost(req(), ctx({ versionId: 'v1' })),
    ]) {
      expect((await call()).status).toBe(401)
    }
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('versions list: GET proxies path and body', async () => {
    apiFetch.mockResolvedValue(backend(200, { items: [] }))
    const res = await listGet(req(), ctx())
    expect(apiFetch).toHaveBeenCalledWith('/v1/spaces/s1/notes/n1/versions', {}, 'tok')
    expect(await res.json()).toEqual({ items: [] })
  })

  it('versions create: POST forwards the reason body', async () => {
    apiFetch.mockResolvedValue(backend(200, { id: 'v9' }))
    const res = await createPost(req('{"reason":"manual"}'), ctx())
    expect(apiFetch).toHaveBeenCalledWith(
      '/v1/spaces/s1/notes/n1/versions',
      { method: 'POST', body: '{"reason":"manual"}' },
      'tok'
    )
    expect(res.status).toBe(200)
  })

  it('versions create: POST with no body sends none', async () => {
    apiFetch.mockResolvedValue(backend(200, { id: 'v9' }))
    await createPost(req(), ctx())
    expect(apiFetch.mock.calls[0][1]).toEqual({ method: 'POST', body: undefined })
  })

  it('version get: forwards the version id and a 404', async () => {
    apiFetch.mockResolvedValue(backend(404, { error: { code: 'not_found' } }))
    const res = await oneGet(req(), ctx({ versionId: 'v1' }))
    expect(apiFetch).toHaveBeenCalledWith('/v1/spaces/s1/notes/n1/versions/v1', {}, 'tok')
    expect(res.status).toBe(404)
  })

  it('restore: POSTs to the restore path and relays the page', async () => {
    apiFetch.mockResolvedValue(backend(200, { id: 'n1', title: 'Old' }))
    const res = await restorePost(req(), ctx({ versionId: 'v1' }))
    expect(apiFetch).toHaveBeenCalledWith(
      '/v1/spaces/s1/notes/n1/versions/v1/restore',
      { method: 'POST' },
      'tok'
    )
    expect(await res.json()).toEqual({ id: 'n1', title: 'Old' })
  })

  it('survives a non-JSON backend body', async () => {
    apiFetch.mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502 }))
    const res = await listGet(req(), ctx())
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ detail: 'Invalid response from server' })
  })
})
