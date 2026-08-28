'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { Lockup } from '@/components/brand/Lockup'
import LegalFinePrint from '@/components/auth/LegalFinePrint'
import ThemeToggle from '@/components/dashboard/ThemeToggle'
import styles from './signup.module.css'
import { useRouter } from 'next/navigation'
import { markSignupPending } from './actions'

function ContourBg() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" strokeWidth="1" className={styles.contourPath}>
        <path d="M-50 520C220 400 360 560 640 460 940 352 1120 550 1520 440" />
        <path d="M-50 580C220 460 360 620 640 520 940 412 1120 610 1520 500" />
        <path d="M-50 460C240 350 380 510 660 410 960 302 1120 490 1520 380" />
        <path d="M-50 640C200 530 360 690 640 590 940 482 1120 670 1520 560" />
        <path d="M-50 400C260 300 400 450 680 360 980 260 1120 430 1520 330" />
      </g>
    </svg>
  )
}

function StrengthBar({ password }: { password: string }) {
  const getStrength = (p: string) => {
    if (p.length === 0) return 0
    let score = 0
    if (p.length >= 8) score++
    if (/[A-Z]/.test(p)) score++
    if (/[0-9]/.test(p)) score++
    if (/[^A-Za-z0-9]/.test(p)) score++
    return score
  }

  const strength = getStrength(password)
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['', 'var(--error-color)', '#E0A03A', '#7FA88C', 'var(--accent-color)']

  if (!password) return null

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= strength ? colors[strength] : 'var(--divider)',
              transition: 'background .2s',
            }}
          />
        ))}
      </div>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: colors[strength] }}>
        {labels[strength]}
      </span>
    </div>
  )
}

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null)
  const [loading, setLoading] = useState(false)
   const router = useRouter()

  const supabase = createClient()

  const handleGoogleSignup = async () => {
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

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (password !== confirmPassword) {
      setMessage({ text: "Passwords don't match.", type: 'error' })
      return
    }
    if (password.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters.', type: 'error' })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      })

      if (error) throw new Error(error.message)

      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setMessage({
          text: 'An account with this email already exists. Try logging in instead.',
          type: 'error',
        })
        return
      }

      await markSignupPending(email)
      router.refresh()
      router.replace('/signup/verify')
      return
      return

    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.pageWrapper}>
      <ContourBg />

      {/* Brand top-left */}
      <Link href="/" className={styles.brandLink}>
        <Lockup size={24} />
      </Link>
      <div className={styles.themeToggleWrap}>
        <ThemeToggle />
      </div>

      <div className={styles.container}>
        {/* Plate label */}
        <div className={styles.plateLabel}>
          <span className={styles.plateNumber}>01</span>
          <span className={styles.plateTitle}>Create account</span>
          <span className={styles.plateLine} />
        </div>

        <div className={styles.card}>
          <h1 className={styles.heading}>Start for free.</h1>
          <p className={styles.subheading}>Build a learning memory that never forgets.</p>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleSignup}
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
          <div className={styles.dividerContainer}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>or</span>
            <span className={styles.dividerLine} />
          </div>

          {/* Form */}
          <form onSubmit={handleEmailSignUp} className={styles.form}>
            {/* Email */}
            <div>
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

            {/* Password */}
            <div>
              <label htmlFor="password" className={styles.label}>Password</label>
              <input
                id="password"
                type="password"
                required
                placeholder="Min. 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={styles.input}
              />
              <StrengthBar password={password} />
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirm" className={styles.label}>Confirm password</label>
              <input
                id="confirm"
                type="password"
                required
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className={`${styles.input} ${confirmPassword && confirmPassword !== password ? styles.inputError : ''}`}
              />
              {confirmPassword && confirmPassword !== password && (
                <span className={styles.errorText}>
                  Passwords don&apos;t match
                </span>
              )}
            </div>

            {message && (
              <p className={`${styles.message} ${message.type === 'error' ? styles.messageError : styles.messageSuccess}`}>
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className={styles.submitBtn}
            >
              {loading ? 'Creating account…' : <>Create account <span>→</span></>}
            </button>
          </form>

          <LegalFinePrint />

          {/* Login link */}
          <p className={styles.footerText}>
            Already have an account?{' '}
            <Link href="/login" className={styles.loginLink}>
              Sign in
            </Link>
          </p>
        </div>

        <p className={styles.copyright}>
          © {new Date().getFullYear()} exomemri · Your AI learning memory
        </p>
      </div>
    </div>
  )
}