// app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

export default async function DashboardLayout({
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
    // 2. Query your backend's profile-status checkpoint
    const statusResponse = await apiFetch('/v1/auth/profile-status', {}, token)

    if (statusResponse.ok) {
      const statusData = await statusResponse.json()

      // 3. If no profile exists, they skipped onboarding. Boot them to the form!
      if (!statusData.has_completed_onboarding) {
        shouldRedirectTo = '/onboarding'
      }
    } else {
      // If the backend rejects the token outright (expired/fake), treat them as logged out
      shouldRedirectTo = '/login'
    }
  } catch (error) {
    console.error("Dashboard layout gate failure:", error)
    // Fallback safely to login if your backend architecture is un-reachable
    shouldRedirectTo = '/login'
  }

  // 4. Execute the redirect smoothly outside of the try/catch context 🚀
  if (shouldRedirectTo) {
    redirect(shouldRedirectTo)
  }

  // 5. Authorized and onboarded. Render the dashboard layout view!
  return <>{children}</>
}