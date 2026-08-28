import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import VerifyClient from './VerifyClient'

export default async function VerifyPage() {
  const cookieStore = await cookies()
  const email = cookieStore.get('signup_pending')?.value

  if (!email) redirect('/signup')

  return <VerifyClient email={email} />
}