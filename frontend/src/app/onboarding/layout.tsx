import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server' // Adjust path if needed

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // 1. Get the session directly on the server
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Query the database row on the server before anything renders
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  // 3. If they already completed onboarding, block the page and redirect instantly
  if (profile) {
    redirect('/dashboard')
  }

  // 4. If they are a true new user, safely render the page.tsx form
  return <>{children}</>
}