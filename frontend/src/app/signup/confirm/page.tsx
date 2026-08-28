import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import ConfirmClient from './ConfirmClient'

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>
}) {
  const { token_hash, type } = await searchParams

  if (!token_hash || type !== 'signup') {
    redirect('/signup')
  }

  return (
    <Suspense fallback={null}>
      <ConfirmClient />
    </Suspense>
  )
}