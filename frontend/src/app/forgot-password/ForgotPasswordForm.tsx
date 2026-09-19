'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lockup } from '@/components/brand/Lockup'
import ThemeToggle from '@/components/dashboard/ThemeToggle'
import styles from '../login/login.module.css' // reuse login page styling

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      // Always show generic success, regardless of response — never reveal
      // whether an account exists for this email.
      if (!res.ok && res.status !== 429) {
        throw new Error()
      }
      if (res.status === 429) {
        setMessage({ text: 'Too many requests. Please try again later.', type: 'error' })
      } else {
        setSubmitted(true)
      }
    } catch {
      setMessage({ text: 'Something went wrong. Please try again.', type: 'error' })
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
        <ThemeToggle />
      </div>

      <div className={styles.cardWrapper}>
        <div className={styles.card}>
          <h1 className={styles.title}>Reset your password.</h1>

          {submitted ? (
            <p className={styles.subtitle}>
              If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset your password.
              Check your inbox (and spam folder).
            </p>
          ) : (
            <>
              <p className={styles.subtitle}>
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                  <label htmlFor="email" className={styles.label}>Email</label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={styles.input}
                  />
                </div>

                {message && (
                  <p className={`${styles.message} ${message.type === 'error' ? styles.errorMessage : styles.successMessage}`}>
                    {message.text}
                  </p>
                )}

                <button type="submit" disabled={loading} className={styles.submitBtn}>
                  {loading ? 'Sending…' : <>Send reset link <span>→</span></>}
                </button>
              </form>
            </>
          )}

          <p className={styles.signupText}>
            <Link href="/login" className={styles.signupLink}>Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}