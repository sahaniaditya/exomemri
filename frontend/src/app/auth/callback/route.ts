import { NextResponse } from 'next/server'
import { createClient } from '../../../utils/supabase/server'
import { apiFetch } from '@/lib/api'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // 1. Fail early if no auth code exists
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code_provided`)
  }

  try {
    const supabase = await createClient()
    
    // 2. Exchange PKCE code for a valid session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data.session) {
      console.error('Supabase code exchange failed:', error?.message)
      return NextResponse.redirect(`${origin}/login?error=exchange_failed`)
    }

    const accessToken = data.session.access_token
    const refreshToken = data.session.refresh_token

    // 3. Determine the landing page directly by checking user profile status
    const statusResponse = await apiFetch('/api/v1/auth/profile-status', {}, accessToken)
    
    let destination = '/onboarding'
    if (statusResponse.ok) {
      const statusData = await statusResponse.json()
      if (statusData.has_completed_onboarding) {
        destination = '/dashboard'
      }
    }

    // 4. Instantiate the redirect response object explicitly
    const response = NextResponse.redirect(`${origin}${destination}`)

    // 5. Force-bake the cookies directly onto this response object 🚀
    response.cookies.set('atlas_token', accessToken, {
      path: '/',
      maxAge: 3600, // 1 hour
      secure: true,
      sameSite: 'lax',
      httpOnly: true,
    })

    response.cookies.set('atlas_refresh_token', refreshToken, {
      path: '/',
      maxAge: 604800, // 7 days
      secure: true,
      sameSite: 'lax',
      httpOnly: true,
    })

    // 6. Return the configured response object
    return response

  } catch (err) {
    console.error('Auth callback system failure:', err)
    return NextResponse.redirect(`${origin}/login?error=callback_exception`)
  }
}