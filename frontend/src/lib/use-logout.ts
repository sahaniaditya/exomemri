'use client'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { clearExtensionSession } from '@/lib/extension-session'
/**
 * The one sign-out path, shared by every control that offers one.
 *
 * Order matters and is the reason this is not inlined per component: the
 * httpOnly cookies can only be dropped by the server, and the extension's copy
 * of the session can only be dropped from page JS. Both have to happen, and
 * `clearExtensionSession()` has to run *before* we navigate — it dispatches the
 * event the extension's bridge listens for, and a page that is already tearing
 * down never fires it.
 *
 * The clear runs even when the backend call fails: a half-signed-out state
 * where the extension still holds a token is worse than a failed server call.
 */
export function useLogout(): { logout: () => Promise<void>; loggingOut: boolean } {
  const router = useRouter()
  const { setTheme } = useTheme()
  const [loggingOut, setLoggingOut] = useState(false)
  const logout = useCallback(async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      clearExtensionSession()
      router.refresh()
      router.push('/login')
      setLoggingOut(false)
      // setTheme('light')
    }
  }, [router, setTheme])
  return { logout, loggingOut }
}