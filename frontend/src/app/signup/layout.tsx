import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server' // Adjust path if needed

export default async function SignupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // 1. Check if the user already has a valid session on the server
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // 2. Double-check if they have finished onboarding
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    // 🚀 Forward them straight to where they belong!
    if (profile) {
      redirect('/dashboard')
    } else {
      redirect('/onboarding')
    }
  }

  // If they are not logged in, let them see the login/signup form safely
  return <>{children}</>
}