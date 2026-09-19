import { createClient } from '@/utils/supabase/client'

const supabase = createClient()

/**
 * Fetches a fresh Supabase access token from the existing bridge-session
 * endpoint (same one the extension bridge uses) and applies it to the
 * Realtime client, so postgres_changes subscriptions get evaluated
 * against the logged-in user's RLS policies.
 *
 * We deliberately don't call supabase.auth.setSession() here — auth in
 * this app never runs through supabase-js (tokens live in httpOnly
 * cookies set by establishSession), so there's no local session to
 * hydrate. Realtime only needs the bearer token itself.
 */
export async function syncRealtimeAuth(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/bridge-session', {
      cache: 'no-store',
      credentials: 'include',
    })

    if (!res.ok) {
      console.warn('[syncRealtimeAuth] bridge-session returned', res.status)
      return null
    }

    const data = (await res.json()) as { access_token: string }
    if (!data.access_token) return null

    supabase.realtime.setAuth(data.access_token)
    return data.access_token
  } catch (err) {
    console.error('[syncRealtimeAuth] Failed to fetch/apply token:', err)
    return null
  }
}