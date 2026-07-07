import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server' // Adjust path if needed

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // 1. Check for active auth session on the server
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Verify that they have completed onboarding
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  // 3. If no profile exists, they skipped onboarding. Boot them to the form!
  if (!profile) {
    redirect('/onboarding')
  }

  // 4. Authorized and onboarded. Render the dashboard page!
  return <>{children}</>
}