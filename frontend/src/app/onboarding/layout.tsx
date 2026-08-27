// app/onboarding/layout.tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 1. Extract the active access token directly from the server-side cookies
  const cookieStore = await cookies()
  const token = cookieStore.get('atlas_token')?.value

  // If no token exists at all on the server, boot them back to login immediately
  if (!token) {
    redirect('/login')
  }

  let shouldRedirectTo: string | null = null

  try {
    // 2. Query the dedicated profile status route to see if they're onboarded
    const statusResponse = await apiFetch('/v1/auth/profile-status', {}, token)

    

    if (statusResponse.ok) {
      const statusData = await statusResponse.json()

      console.log('[LOGIN LAYOUT]', { token: token?.slice(0, 12), status: statusResponse.status, statusData })


      // 3. If they already completed onboarding, block this page and kick them to dashboard
      if (statusData.has_completed_onboarding) {
        shouldRedirectTo = '/dashboard'
      }
    } else {
      // If the backend rejects the token outright, treat them as logged out
      shouldRedirectTo = '/login'
    }
  } catch (error) {
    console.error("Onboarding layout gate failure:", error)
    // Fallback safely to login if your backend architecture is unreachable
    shouldRedirectTo = '/login'
  }

  // 4. Execute the redirect smoothly outside of the try/catch context 🚀
  if (shouldRedirectTo) {
    redirect(shouldRedirectTo)
  }

  // 5. If they have a valid token but NO profile yet, safely render the onboarding steps
  return <>{children}</>
}