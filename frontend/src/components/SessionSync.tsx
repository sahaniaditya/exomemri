'use client'

import { useEffect } from 'react'

import {
  clearExtensionSession,
  writeExtensionSession,
  type BridgeSessionResponse,
} from '@/lib/extension-session'

/**
 * Invisible bridge for the browser extension. On mount (i.e. whenever a
 * logged-in user lands on an authenticated page, after ANY sign-in flow —
 * email/password, Google OAuth, or email link — and on every refresh), it
 * fetches the session from /api/auth/bridge-session and mirrors it into
 * localStorage for the extension's content script to read. On 401 it clears
 * the cached blob.
 *
 * This one mechanism covers all flows uniformly, including the OAuth callback
 * (a pure server redirect that never hands the token to client JS).
 */
export default function SessionSync() {
  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const res = await fetch('/api/auth/bridge-session')
        if (cancelled) return
        if (res.ok) {
          const data = (await res.json()) as BridgeSessionResponse
          writeExtensionSession(data)
        } else {
          clearExtensionSession()
        }
      } catch {
        // Network hiccup: leave any existing blob untouched.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
