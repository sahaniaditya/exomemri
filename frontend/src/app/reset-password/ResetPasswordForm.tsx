'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lockup } from '@/components/brand/Lockup'
import styles from '../login/login.module.css'

type Stage = 'ready' | 'invalid' | 'done'

export default function ResetPasswordForm({
  tokenHash,
  type,
}: {
  tokenHash: string | null
  type: string | null
}) {

  const [stage, setStage] = useState<Stage>(
    tokenHash && type === 'recovery' ? 'ready' : 'invalid'
  )
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' })
      return
    }
    if (password.length < 8) {
      setMessage({ text: 'Password must be at least 8 characters.', type: 'error' })
      return
    }
    if (!tokenHash) return

    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_hash: tokenHash, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not reset password.')

      setStage('done')
      setTimeout(() => router.push('/login'), 2000)
    } catch (error) {
      // Token is single-use — if verify_otp already succeeded once (e.g. a
      // retried request) but this attempt fails, don't leave the user
      // stuck retrying a dead token silently.
      setMessage({
        text: error instanceof Error ? error.message : 'Could not reset password.',
        type: 'error',
      })
      setStage('invalid')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerBar}>
        <Link href="/" className={styles.brandLink}>
          <Lockup size={24} />
        </Link>
      </div>

      <div className={styles.cardWrapper}>
        <div className={styles.card}>
          {stage === 'invalid' && (
            <>
              <h1 className={styles.title}>Link expired or invalid.</h1>
              <p className={styles.subtitle}>
                Password reset links only work once and expire after a while.
              </p>
              <Link href="/forgot-password" className={styles.signupLink}>
                Request a new link
              </Link>
            </>
          )}

          {stage === 'ready' && (
            <>
              <h1 className={styles.title}>Set a new password.</h1>
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                  <label htmlFor="password" className={styles.label}>New password</label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="confirmPassword" className={styles.label}>Confirm password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={styles.input}
                  />
                </div>

                {message && (
                  <p className={`${styles.message} ${message.type === 'error' ? styles.errorMessage : styles.successMessage}`}>
                    {message.text}
                  </p>
                )}

                <button type="submit" disabled={loading} className={styles.submitBtn}>
                  {loading ? 'Updating…' : <>Update password <span>→</span></>}
                </button>
              </form>
            </>
          )}

          {stage === 'done' && (
            <>
              <h1 className={styles.title}>Password updated.</h1>
              <p className={styles.subtitle}>Redirecting you to sign in…</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}