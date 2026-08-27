import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { atlasFontVars } from '@/lib/fonts'
import type { RedeemShareLinkResult } from '@/lib/sharing'
import { Lockup } from '@/components/brand/Lockup'
import styles from '@/components/dashboard/dashboard.module.css'

export const metadata: Metadata = {
  title: 'Shared capture · exomemri',
  description: 'Open a capture someone shared with you.',
}

interface ShareRedeemPageProps {
  params: Promise<{ token: string }>
}

export default async function ShareRedeemPage({ params }: ShareRedeemPageProps) {
  const { token: shareToken } = await params
  const session = (await cookies()).get('atlas_token')?.value ?? ''

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/s/${shareToken}`)}`)
  }

  let result: RedeemShareLinkResult | null = null
  let failed = false
  try {
    const res = await apiFetch(
      `/v1/share-links/${encodeURIComponent(shareToken)}/redeem`,
      { method: 'POST' },
      session
    )
    if (res.ok) {
      result = (await res.json()) as RedeemShareLinkResult
    } else {
      failed = true
    }
  } catch (error) {
    console.error('Failed to redeem share link:', error)
    failed = true
  }

  if (result) {
    if (result.is_owner) {
      redirect(`/dashboard/spaces/${result.space_id}/sources/${result.source_id}`)
    }
    redirect(`/dashboard/shared/sources/${result.source_id}`)
  }

  return (
    <div className={`${styles.app} ${atlasFontVars}`}>
      <main className={`${styles.main} ${styles.shareRedeemMain}`}>
        <Link href="/" aria-label="exomemri home">
          <Lockup size={24} />
        </Link>
        <h1 className={styles.dialogTitle}>
          {failed ? 'This link is unavailable' : 'Something went wrong'}
        </h1>
        <p className={styles.dialogSub}>
          {failed
            ? 'The share link may have been turned off, or the capture was removed.'
            : 'Could not open this shared capture. Please try again.'}
        </p>
        <p className={styles.dialogSub}>
          <Link href="/dashboard">Back to dashboard</Link>
        </p>
      </main>
    </div>
  )
}
