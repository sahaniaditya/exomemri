'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'

function Glyph({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="14.5" stroke="#2C5D4F" />
      <path
        d="M16 1.5v29M1.5 16h29M6 6c6 5 14 5 20 0M6 26c6-5 14-5 20 0M4.2 10.5c7 3.5 16.6 3.5 23.6 0M4.2 21.5c7-3.5 16.6-3.5 23.6 0"
        stroke="#2C5D4F"
        strokeWidth="1"
        opacity=".55"
      />
      <circle cx="16" cy="16" r="2.4" fill="#B5623C" />
    </svg>
  )
}

function ContourBg() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" stroke="#2C5D4F" strokeWidth="1" opacity=".10">
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
  const colors = ['', '#B5623C', '#E0A03A', '#7FA88C', '#2C5D4F']

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
              background: i <= strength ? colors[strength] : 'rgba(27,26,22,.12)',
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
  const supabase = createClient()

  const handleGoogleSignup = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
    setLoading(false)
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    setLoading(false)

    if (error) setMessage({ text: error.message, type: 'error' })
    else setMessage({ text: 'Check your email for the verification link!', type: 'success' })
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&family=Newsreader:ital,wght@0,400;1,400&display=swap');
        body { margin: 0; background: #F4F1E9; font-family: 'Instrument Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        * { box-sizing: border-box; }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #FBFAF6 inset !important;
          -webkit-text-fill-color: #1B1A16 !important;
        }
      `}</style>

      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F1E9] px-4 py-10">
        <ContourBg />

        {/* Brand top-left */}
        <Link
          href="/"
          className="absolute left-8 top-7 flex items-center gap-2.5 no-underline"
          style={{ fontFamily: 'Newsreader', fontSize: 20, letterSpacing: '-0.03em', color: '#1B1A16', textDecoration: 'none' }}
        >
          <Glyph size={24} />
          <span style={{ fontWeight: 500 }}>atlas<span style={{ color: '#2C5D4F' }}>.ai</span></span>
        </Link>

        <div className="relative z-10 w-full" style={{ maxWidth: 440 }}>

          {/* Plate label */}
          <div className="mb-6 flex items-center gap-3">
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#2C5D4F', fontWeight: 500 }}>01</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7C8A7E' }}>Create account</span>
            <span style={{ height: 1, flex: 1, background: 'rgba(27,26,22,.14)' }} />
          </div>

          <div
            style={{
              background: '#FBFAF6',
              border: '1px solid rgba(27,26,22,.13)',
              borderRadius: 8,
              boxShadow: '0 1px 0 rgba(27,26,22,.04), 0 24px 56px -28px rgba(27,26,22,.22)',
              padding: '40px 40px 36px',
            }}
          >
            <h1
              style={{
                fontFamily: 'Newsreader',
                fontSize: 34,
                fontWeight: 400,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                color: '#1B1A16',
                margin: '0 0 6px',
              }}
            >
              Start for free.
            </h1>
            <p style={{ fontSize: 15, color: '#5B5A52', margin: '0 0 28px' }}>
              Build a learning memory that never forgets.
            </p>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={loading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background: '#fff',
                border: '1px solid rgba(27,26,22,.18)',
                borderRadius: 4,
                padding: '11px 18px',
                fontSize: 15,
                fontFamily: 'Instrument Sans',
                fontWeight: 600,
                color: '#1B1A16',
                cursor: 'pointer',
                transition: 'border-color .15s',
                marginBottom: 22,
              }}
              onMouseOver={e => (e.currentTarget.style.borderColor = 'rgba(27,26,22,.38)')}
              onMouseOut={e => (e.currentTarget.style.borderColor = 'rgba(27,26,22,.18)')}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
              <span style={{ flex: 1, height: 1, background: 'rgba(27,26,22,.12)' }} />
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: '0.1em', color: '#9AA69C' }}>or</span>
              <span style={{ flex: 1, height: 1, background: 'rgba(27,26,22,.12)' }} />
            </div>

            {/* Form */}
            <form onSubmit={handleEmailSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7C8A7E', display: 'block', marginBottom: 6 }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 13px',
                    background: '#F4F1E9',
                    border: '1px solid rgba(27,26,22,.16)',
                    borderRadius: 4,
                    fontSize: 15,
                    color: '#1B1A16',
                    outline: 'none',
                    fontFamily: 'Instrument Sans',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#2C5D4F')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(27,26,22,.16)')}
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7C8A7E', display: 'block', marginBottom: 6 }}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 13px',
                    background: '#F4F1E9',
                    border: '1px solid rgba(27,26,22,.16)',
                    borderRadius: 4,
                    fontSize: 15,
                    color: '#1B1A16',
                    outline: 'none',
                    fontFamily: 'Instrument Sans',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#2C5D4F')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(27,26,22,.16)')}
                />
                <StrengthBar password={password} />
              </div>

              {/* Confirm password */}
              <div>
                <label
                  htmlFor="confirm"
                  style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7C8A7E', display: 'block', marginBottom: 6 }}
                >
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  required
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 13px',
                    background: '#F4F1E9',
                    border: confirmPassword && confirmPassword !== password
                      ? '1px solid #B5623C'
                      : '1px solid rgba(27,26,22,.16)',
                    borderRadius: 4,
                    fontSize: 15,
                    color: '#1B1A16',
                    outline: 'none',
                    fontFamily: 'Instrument Sans',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#2C5D4F')}
                  onBlur={e => {
                    e.target.style.borderColor =
                      confirmPassword && confirmPassword !== password
                        ? '#B5623C'
                        : 'rgba(27,26,22,.16)'
                  }}
                />
                {confirmPassword && confirmPassword !== password && (
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#B5623C', marginTop: 5, display: 'block' }}>
                    Passwords don&apos;t match
                  </span>
                )}
              </div>

              {message && (
                <p style={{
                  fontSize: 13.5,
                  color: message.type === 'error' ? '#B5623C' : '#2C5D4F',
                  margin: 0,
                  fontFamily: 'IBM Plex Mono',
                }}>
                  {message.text}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  marginTop: 4,
                  padding: '12px 18px',
                  background: loading ? '#7FA88C' : '#2C5D4F',
                  color: '#F4F1E9',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 15,
                  fontFamily: 'Instrument Sans',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background .18s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onMouseOver={e => { if (!loading) e.currentTarget.style.background = '#234c40' }}
                onMouseOut={e => { if (!loading) e.currentTarget.style.background = '#2C5D4F' }}
              >
                {loading ? 'Creating account…' : <>Create account <span>→</span></>}
              </button>
            </form>

            {/* Fine print */}
            <p style={{ marginTop: 16, fontSize: 12.5, color: '#9AA69C', textAlign: 'center', lineHeight: 1.5 }}>
              By signing up you agree to our{' '}
              <a href="#" style={{ color: '#5B5A52', textDecoration: 'underline' }}>Terms</a>
              {' '}and{' '}
              <a href="#" style={{ color: '#5B5A52', textDecoration: 'underline' }}>Privacy Policy</a>.
            </p>

            {/* Login link */}
            <p style={{ marginTop: 20, textAlign: 'center', fontSize: 14, color: '#5B5A52' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: '#2C5D4F', fontWeight: 600, textDecoration: 'none' }}>
                Sign in
              </Link>
            </p>
          </div>

          <p style={{ marginTop: 20, textAlign: 'center', fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#9AA69C', letterSpacing: '0.06em' }}>
            © {new Date().getFullYear()} Atlas.ai · Your AI learning memory
          </p>
        </div>
      </div>
    </>
  )
}
