'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { Lockup } from '@/components/brand/Lockup'
import styles from '../signup.module.css'
import { useRouter } from 'next/navigation'
import { consumeSignupPending } from '../actions'

export default function VerifyClient({ email }: { email: string }) {
  const router = useRouter()

  useEffect(() => {
    // Burn the cookie right after this page has successfully loaded once,
    // so any future visit to this URL (back button, retype, refresh) fails the gate.
    consumeSignupPending()

    const url = window.location.href
    history.pushState(null, '', url)
    history.pushState(null, '', url)

    const onPopState = () => {
      history.pushState(null, '', url)
      router.replace('/signup/verify')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [router])

  return (
    <div className={styles.pageWrapper}>
      <Link href="/" className={styles.brandLink}>
        <Lockup size={24} />
      </Link>
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.heading}>Check your inbox.</h1>
          <p className={styles.subheading}>
            We sent a verification link to <strong>{email}</strong>. Click it to activate your account.
          </p>
          <p className={styles.finePrint} style={{ marginTop: 24 }}>
            Didn&apos;t get it? Check spam,{' '}
            <Link href="/signup" className={styles.finePrintLink}>try signing up again</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}