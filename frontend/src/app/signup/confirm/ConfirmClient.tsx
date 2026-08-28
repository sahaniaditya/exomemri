'use client'
import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { confirmSignup } from './action'
import { Lockup } from '@/components/brand/Lockup'
import styles from '../signup.module.css'

export default function ConfirmClient() {
  const params = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const handleClick = async () => {
    const token_hash = params.get('token_hash')
    if (!token_hash) {
      setError(true)
      return
    }
    setLoading(true)
    const result = await confirmSignup(token_hash, 'signup')
    if (result.error) {
      setError(true)
      setLoading(false)
      return
    }
    router.replace(result.destination!)
  }

  return (
    <div className={styles.pageWrapper}>
      <Link href="/" className={styles.brandLink}>
        <Lockup size={24} />
      </Link>

      <div className={styles.container}>
        <div className={styles.plateLabel}>
          <span className={styles.plateNumber}>02</span>
          <span className={styles.plateTitle}>
            {error ? 'Link expired' : 'Confirm email'}
          </span>
          <span className={styles.plateLine} />
        </div>

        <div className={styles.card}>
          {error ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <ErrorIcon />
              </div>
              <h1 className={styles.heading}>Link expired</h1>
              <p className={styles.subheading}>
                This confirmation link has expired or was already used.
              </p>
              <Link href="/signup" className={styles.submitBtn} style={{ marginTop: 24, textAlign: 'center', textDecoration: 'none' }}>
                Sign up again <span>→</span>
              </Link>
            </>
          ) : (
            <>
              <h1 className={styles.heading}>Confirm your account</h1>
              <p className={styles.subheading}>
                Click below to finish setting up your account.
              </p>
              <button
                onClick={handleClick}
                disabled={loading}
                className={styles.submitBtn}
                style={{ marginTop: 24 }}
              >
                {loading ? (
                  <>
                    <Spinner /> Confirming…
                  </>
                ) : (
                  <>Confirm email <span>→</span></>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      style={{ marginRight: 8, animation: 'spin 0.8s linear infinite', verticalAlign: 'middle' }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="var(--error-color)" strokeWidth="1.5" />
      <path d="M12 8v5" stroke="var(--error-color)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill="var(--error-color)" />
    </svg>
  )
}