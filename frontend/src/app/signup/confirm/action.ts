'use server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { apiFetch } from '@/lib/api'
import { isAllowedShareReturnPath } from '@/lib/sharing'

const RETURN_TO_COOKIE = 'atlas_return_to'

export async function confirmSignup(token_hash: string, type: 'signup') {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ token_hash, type })

  if (error || !data.session) {
    return { error: 'expired' as const }
  }

  const accessToken = data.session.access_token
  const refreshToken = data.session.refresh_token
  const cookieStore = await cookies()

  cookieStore.set('atlas_token', accessToken, {
    path: '/', maxAge: 3600, secure: true, sameSite: 'lax', httpOnly: true,
  })
  cookieStore.set('atlas_refresh_token', refreshToken, {
    path: '/', maxAge: 604800, secure: true, sameSite: 'lax', httpOnly: true,
  })

  let destination = '/onboarding'
  const statusResponse = await apiFetch('/v1/auth/profile-status', {}, accessToken)
  if (statusResponse.ok) {
    const statusData = await statusResponse.json()
    if (statusData.has_completed_onboarding) {
      destination = '/dashboard'
      const stashed = cookieStore.get(RETURN_TO_COOKIE)?.value ?? null
      if (isAllowedShareReturnPath(stashed)) destination = stashed
    }
  }
  cookieStore.delete(RETURN_TO_COOKIE)

  return { error: null, destination }
}