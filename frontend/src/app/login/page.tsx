'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Lockup } from '@/components/brand/Lockup'
import { refreshExtensionSession } from '@/lib/extension-session'
import ThemeToggle from '@/components/dashboard/ThemeToggle'
import styles from './login.module.css'

function ContourBg() {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${styles.contourSvg}`}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" stroke="#2C5D4F" strokeWidth="1">
        <path d="M-50 520C220 400 360 560 640 460 940 352 1120 550 1520 440" />
        <path d="M-50 580C220 460 360 620 640 520 940 412 1120 610 1520 500" />
        <path d="M-50 460C240 350 380 510 660 410 960 302 1120 490 1520 380" />
        <path d="M-50 640C200 530 360 690 640 590 940 482 1120 670 1520 560" />
        <path d="M-50 400C260 300 400 450 680 360 980 260 1120 430 1520 330" />
      </g>
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    })
    if (error) {
      setMessage({ text: error.message, type: 'error' })
      setLoading(false)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Invalid credentials.')

      await refreshExtensionSession()
      router.push(data.redirectTo)
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Invalid credentials.',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <ContourBg />

      {/* Header Bar */}
      <div className={styles.headerBar}>
        <Link href="/" className={styles.brandLink}>
          <Lockup size={24} />
        </Link>
        <ThemeToggle />
      </div>

      {/* Card */}
      <div className={styles.cardWrapper}>
        <div className={styles.plateLabel}>
          <span className={styles.plateNumber}>01</span>
          <span className={styles.plateTitle}>Sign in</span>
          <span className={styles.plateLine} />
        </div>

        <div className={styles.card}>
          <h1 className={styles.title}>Welcome back.</h1>
          <p className={styles.subtitle}>Sign in to your learning memory.</p>

          {/* Google Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className={styles.googleBtn}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>or</span>
            <span className={styles.dividerLine} />
          </div>

          {/* Email Form */}
          <form onSubmit={handleEmailSignIn} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>Email</label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <div className={styles.labelRow}>
                <label htmlFor="password" className={styles.label}>Password</label>
                <a href="#" className={styles.forgotLink}>Forgot?</a>
              </div>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={styles.input}
              />
            </div>

            {message && (
              <p className={`${styles.message} ${message.type === 'error' ? styles.errorMessage : styles.successMessage}`}>
                {message.text}
              </p>
            )}

            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading ? 'Signing in…' : <>Sign in <span>→</span></>}
            </button>
          </form>

          {/* Signup link */}
          <p className={styles.signupText}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" className={styles.signupLink}>
              Create one free
            </Link>
          </p>
        </div>

        <p className={styles.footerText}>
          © {new Date().getFullYear()} exomemri · Your AI learning memory
        </p>
      </div>
    </div>
  )
}