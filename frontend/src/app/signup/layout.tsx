// app/signup/layout.tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

export default async function SignupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('atlas_token')?.value

  if (token) {
    let shouldRedirectTo: string | null = null

    try {
      const statusResponse = await apiFetch('/api/v1/auth/profile-status', {}, token)

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()

        // 1. Instead of executing redirect() inside try, just save the route string
        if (statusData.has_completed_onboarding) {
          shouldRedirectTo = '/dashboard'
        } else {
          shouldRedirectTo = '/onboarding'
        }
      }
    } catch (error) {
      // Real API network crashes get caught safely here
      console.error("Layout session gate check failed:", error)
    }

    // 2. Execute the redirect completely OUTSIDE the try/catch block 🚀
    if (shouldRedirectTo) {
      redirect(shouldRedirectTo)
    }
  }

  return <>{children}</>
}