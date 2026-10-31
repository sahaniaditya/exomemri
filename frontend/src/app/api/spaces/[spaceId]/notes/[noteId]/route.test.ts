import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  token: 'tok' as string | undefined,
  apiFetch: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'atlas_token' && mocks.token ? { value: mocks.token } : undefined,
  }),
}))
vi.mock('@/lib/api', () => ({ apiFetch: mocks.apiFetch }))

import { DELETE, PUT } from './route'

const params = { params: Promise.resolve({ spaceId: 's1', noteId: 'n1' }) }

function putRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/spaces/s1/notes/n1', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mocks.token = 'tok'
  mocks.apiFetch.mockReset()
})

describe('PUT /api/spaces/[spaceId]/notes/[noteId]', () => {
  it('forwards the body, including expected_updated_at, with the cookie token', async () => {
    mocks.apiFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 'n1', updated_at: 'T1' }), { status: 200 })
    )
    const body = { title: 'x', content: { type: 'doc' }, expected_updated_at: 'T0' }
    const res = await PUT(putRequest(body), params)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'n1', updated_at: 'T1' })
    const [endpoint, init, token] = mocks.apiFetch.mock.calls[0]
    expect(endpoint).toBe('/v1/spaces/s1/notes/n1')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual(body)
    expect(token).toBe('tok')
  })

  it('returns a 409 conflict body to the client unchanged', async () => {
    const conflict = {
      error: { code: 'note_conflict', message: 'x', detail: { updated_at: 'T9' } },
    }
    mocks.apiFetch.mockResolvedValue(new Response(JSON.stringify(conflict), { status: 409 }))
    const res = await PUT(putRequest({ title: 'x', expected_updated_at: 'T0' }), params)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual(conflict)
  })

  it('answers 401 without calling the backend when the cookie is missing', async () => {
    mocks.token = undefined
    const res = await PUT(putRequest({ title: 'x' }), params)
    expect(res.status).toBe(401)
    expect(mocks.apiFetch).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/spaces/[spaceId]/notes/[noteId]', () => {
  it('passes a 204 through', async () => {
    mocks.apiFetch.mockResolvedValue(new Response(null, { status: 204 }))
    const res = await DELETE(
      new NextRequest('http://localhost/api/spaces/s1/notes/n1', { method: 'DELETE' }),
      params
    )
    expect(res.status).toBe(204)
  })
})
