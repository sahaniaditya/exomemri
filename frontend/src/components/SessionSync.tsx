'use client'

import { useEffect } from 'react'

import { refreshExtensionSession } from '@/lib/extension-session'

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
 *
 * This runs on mount only. Anything that changes the session mid-visit — such
 * as creating a Learning Space — must call `refreshExtensionSession()` itself,
 * since `router.refresh()` re-renders server components without remounting.
 */
export default function SessionSync() {
  useEffect(() => {
    void refreshExtensionSession()
  }, [])

  return null
}
