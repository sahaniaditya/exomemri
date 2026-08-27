'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

import {
  EXTENSION_SESSION_KEY,
  EXTENSION_SESSION_REFRESH_MS,
  markExtensionHost,
  refreshExtensionSession,
} from '@/lib/extension-session'

/**
 * Invisible bridge for the browser extension. It mirrors the httpOnly session
 * into localStorage (via /api/auth/bridge-session) so the extension can pick
 * the signed-in user up without the user refreshing anything, and clears that
 * mirror the moment the server says we are no longer authenticated.
 *
 * Mounted once in the root layout — deliberately including unauthenticated
 * routes, because /login is exactly where a stale mirror has to be cleared.
 * That layout does not remount on SPA navigations, so the pathname dependency
 * is what re-runs the mirror on login → dashboard and logout → /login.
 *
 * Mid-visit changes that do not change the path — such as creating a Learning
 * Space — must still call `refreshExtensionSession()` themselves.
 */
export default function SessionSync() {
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false

    // Tell the extension this origin is the web app, signed in or not, so it
    // can distinguish "signed out here" from "some other localhost tab".
    markExtensionHost()

    async function run() {
      await refreshExtensionSession()
      const authed =
        pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding')
      if (
        authed &&
        typeof window !== 'undefined' &&
        !window.localStorage.getItem(EXTENSION_SESSION_KEY) &&
        !cancelled
      ) {
        await new Promise((resolve) => setTimeout(resolve, 250))
        if (!cancelled) await refreshExtensionSession()
      }
    }

    void run()

    function onVisible() {
      if (document.visibilityState === 'visible') void refreshExtensionSession()
    }
    document.addEventListener('visibilitychange', onVisible)

    // A tab left open outliving its 1-hour access token would otherwise leave
    // the extension holding an expired mirror it must treat as signed out.
    const timer = window.setInterval(() => {
      void refreshExtensionSession()
    }, EXTENSION_SESSION_REFRESH_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pathname])

  return null
}
