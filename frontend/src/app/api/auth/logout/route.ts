
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get('atlas_token')?.value

  try {
    if (token) {
      // Alert FastAPI to destroy the session server-side
      await apiFetch('/v1/auth/logout', { method: 'POST' }, token)
    }
  } catch (error) {
    // Fail silently on the network request — even if the backend call
    // fails, we still want to clear the cookies below so the user
    // isn't stuck in a half-logged-in state.
    console.error('Backend logout syncing failed:', error)
  }

  // httpOnly cookies can only be cleared by the server that set them —
  // this is the actual fix for the old document.cookie approach, which
  // silently did nothing once these cookies became httpOnly.
  cookieStore.delete('atlas_token')
  cookieStore.delete('atlas_refresh_token')

  return NextResponse.json({ success: true })
}