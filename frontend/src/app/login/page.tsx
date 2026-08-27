import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { isAllowedShareReturnPath } from '@/lib/sharing'
import LoginForm from './LoginForm'

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const returnTo = isAllowedShareReturnPath(params.next) ? params.next : null

  const cookieStore = await cookies()
  const token = cookieStore.get('atlas_token')?.value
  if (token) {
    try {
      const statusResponse = await apiFetch('/v1/auth/profile-status', {}, token)
      if (statusResponse.ok) {
        const statusData = (await statusResponse.json()) as {
          has_completed_onboarding?: boolean
        }
        if (statusData.has_completed_onboarding) {
          redirect(returnTo ?? '/dashboard')
        }
        redirect('/onboarding')
      }
    } catch (error) {
      console.error('Login page gate failure:', error)
    }
  }

  return <LoginForm returnTo={returnTo} />
}
