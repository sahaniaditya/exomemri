/**
 * Shared plumbing for the notes BFF routes: read the httpOnly `atlas_token`
 * cookie, forward to the backend with `apiFetch`, and pass the status and
 * body straight through. No business logic belongs here.
 */
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

export type SpaceParams = { params: Promise<{ spaceId: string }> }
export type NoteParams = { params: Promise<{ spaceId: string; noteId: string }> }

export const notesEndpoint = (spaceId: string, suffix = '') =>
  `/v1/spaces/${spaceId}/notes${suffix}`

/** Forward one request. `body` (when given) is sent as JSON. */
export async function proxy(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<NextResponse> {
  const token = (await cookies()).get('atlas_token')?.value ?? ''
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  let res: Response
  try {
    res = await apiFetch(
      endpoint,
      { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
      token
    )
  } catch (error) {
    console.error('Notes BFF upstream failure:', error)
    return NextResponse.json({ detail: 'The service is unavailable.' }, { status: 502 })
  }

  if (res.status === 204) return new NextResponse(null, { status: 204 })

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) {
    const headers: Record<string, string> = {}
    if (contentType) headers['content-type'] = contentType
    const disposition = res.headers.get('content-disposition')
    if (disposition) headers['content-disposition'] = disposition
    return new NextResponse(await res.text(), { status: res.status, headers })
  }
  return NextResponse.json(await res.json(), { status: res.status })
}

/** Parse the JSON request body, or answer 400 for malformed input. */
export async function readJson(
  req: Request
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, body: await req.json() }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ detail: 'Invalid JSON body.' }, { status: 400 }),
    }
  }
}
