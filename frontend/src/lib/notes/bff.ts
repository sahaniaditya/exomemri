/**
 * Server-only helper shared by the notes BFF routes: forwards one request to the
 * backend with the httpOnly cookie token and passes status + body straight back.
 */
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

export async function forwardToBackend(
  endpoint: string,
  init: RequestInit = {}
): Promise<NextResponse> {
  const token = (await cookies()).get('atlas_token')?.value ?? ''
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }
  const res = await apiFetch(endpoint, init, token)
  if (res.status === 204) return new NextResponse(null, { status: 204 })
  const data = await res.json().catch(() => ({ detail: 'Invalid response from server' }))
  return NextResponse.json(data, { status: res.status })
}
