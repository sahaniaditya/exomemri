import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

/**
 * Turns the httpOnly session cookies into a client-readable payload for the
 * browser extension. Reads the cookies server-side, fetches the (now
 * Bearer-authenticated) active space from the backend, and returns the token
 * pair + user + space. The client-side <SessionSync /> writes this into
 * localStorage; nothing else exposes the token to page JS.
 */
export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('atlas_token')?.value
  const refreshToken = cookieStore.get('atlas_refresh_token')?.value ?? null

  if (!accessToken) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 })
  }

  try {
    const res = await apiFetch('/v1/session', {}, accessToken)
    if (!res.ok) {
      // Token expired/invalid — signal the client to clear its cached blob.
      return NextResponse.json({ detail: 'Session invalid' }, { status: res.status })
    }
    const session = await res.json()

    return NextResponse.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: session.user,
      space_id: session.active_space?.id ?? null,
      space_name: session.active_space?.name ?? null,
    })
  } catch (error) {
    console.error('bridge-session failed:', error)
    return NextResponse.json({ detail: 'Failed to build bridge session' }, { status: 500 })
  }
}
