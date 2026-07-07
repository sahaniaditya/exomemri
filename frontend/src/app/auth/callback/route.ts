import { NextResponse } from 'next/server'
import { createClient } from '../../../utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  const supabase = await createClient()
  let redirectUrl = '/dashboard'

  // 1. If coming from Google Auth / Magic Link, exchange the code for a session first
  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  // 2. Fetch the logged-in user (works for BOTH code-exchange and direct email login)
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // 3. Single source of truth profile check
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    // If NO profile record exists, divert them to onboarding
    if (!profile) {
      redirectUrl = '/onboarding'
    }
  } else {
    // If no user session is found at all, boot them back to login
    redirectUrl = '/login'
  }

  // 4. Perform the clean server-side redirect
  return NextResponse.redirect(`${origin}${redirectUrl}`)
}