
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

/**
 * Single source of truth for "given a valid access/refresh token pair,
 * decide where the user should land and set their session cookies."
 *
 * Used by both:
 *  - app/auth/callback/route.ts (Google OAuth / PKCE code exchange)
 *  - app/api/auth/session/route.ts (email-link hash flow, called from the client)
 *
 * Keeping this in one place means the two entry points can never drift
 * apart in their profile-status check or cookie settings again.
 */
export async function establishSession(accessToken: string, refreshToken: string) {
  const statusResponse = await apiFetch('/v1/auth/profile-status', {}, accessToken)
  if (!statusResponse.ok) {
    throw new Error('Invalid session')
  }
  const statusData = await statusResponse.json()
  const redirectTo = statusData.has_completed_onboarding ? '/dashboard' : '/onboarding'

  const cookieStore = await cookies()
  cookieStore.set('atlas_token', accessToken, {
    path: '/',
    maxAge: 3600, // 1 hour
    secure: true,
    sameSite: 'strict',
    httpOnly: true,
  })
  cookieStore.set('atlas_refresh_token', refreshToken, {
    path: '/',
    maxAge: 604800, // 7 days
    secure: true,
    sameSite: 'strict',
    httpOnly: true,
  })

  return redirectTo
}