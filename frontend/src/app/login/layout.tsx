// app/login/layout.tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers' 
import { apiFetch } from '@/lib/api'

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 1. Extract the active access token directly from the server-side cookies
  const cookieStore = await cookies()
  const token = cookieStore.get('atlas_token')?.value

  let shouldRedirectTo: string | null = null

  if (token) {
    try {
      // 2. Query your backend's profile-status checkpoint
      const statusResponse = await apiFetch('/v1/auth/profile-status', {}, token)

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()

        console.log('[ONBOARDING LAYOUT]', { token: token?.slice(0, 12), status: statusResponse.status, statusData })

        // 🚀 Determine where they belong without throwing an error inside try block!
        if (statusData.has_completed_onboarding) {
          shouldRedirectTo = '/dashboard'
        } else {
          shouldRedirectTo = '/onboarding'
        }
      }
    } catch (error) {
      // If the backend check fails or the token is expired/invalid,
      // fail silently and let them view the login page safely.
      console.error("Login layout gate failure:", error)
    }

    // 3. Execute the redirect cleanly outside the try/catch block 🚀
    if (shouldRedirectTo) {
      redirect(shouldRedirectTo)
    }
  }

  // If they are not logged in, let them see the login/signup forms safely
  return <>{children}</>
}