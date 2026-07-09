'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { apiFetch } from "@/lib/api"

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
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" stroke="#2C5D4F" strokeWidth="1" opacity=".09">
        <path d="M-50 520C220 400 360 560 640 460 940 352 1120 550 1520 440" />
        <path d="M-50 580C220 460 360 620 640 520 940 412 1120 610 1520 500" />
        <path d="M-50 460C240 350 380 510 660 410 960 302 1120 490 1520 380" />
        <path d="M-50 640C200 530 360 690 640 590 940 482 1120 670 1520 560" />
        <path d="M-50 400C260 300 400 450 680 360 980 260 1120 430 1520 330" />
      </g>
    </svg>
  )
}

const STEP_LABELS = ['Identity', 'Role', 'Domain', 'Discovery']

const ROLES = [
  { value: 'Student',      label: 'Student',       sub: 'Academic context',    icon: '✎' },
  { value: 'Researcher',   label: 'Researcher',     sub: 'Academic / analyst',  icon: '◆' },
  { value: 'Professional', label: 'Professional',   sub: 'Industry / developer', icon: '⌘' },
  { value: 'Self-Learner', label: 'Self-learner',   sub: 'Independent learner', icon: '✦' },
]

const DOMAINS = [
  { value: 'Computer Science',   label: 'Computer Science',   sub: 'Systems & architecture', icon: '⬡' },
  { value: 'Medicine & Health',  label: 'Medicine & Health',  sub: 'Medical sciences',        icon: '◎' },
  { value: 'Business & Finance', label: 'Business & Finance', sub: 'Applied economics',        icon: '↗' },
  { value: 'Languages & Arts',   label: 'Languages & Arts',   sub: 'Humanities',               icon: '◐' },
  { value: 'Other',              label: 'Other',              sub: 'Interdisciplinary fields', icon: '∞' },
]

const REFERRAL_SOURCES = [
  { value: 'Twitter / X',  label: 'Twitter / X',   sub: 'Saw it on your feed',      icon: '𝕏' },
  { value: 'LinkedIn',     label: 'LinkedIn',       sub: 'Post or ad',               icon: 'in' },
  { value: 'YouTube',      label: 'YouTube',        sub: 'Video or recommendation',  icon: '▶' },
  { value: 'Reddit',       label: 'Reddit',         sub: 'Thread or community',      icon: 'r/' },
  { value: 'Instagram',    label: 'Instagram',      sub: 'Story or reel',            icon: '◈' },
  { value: 'Friend',       label: 'A friend',       sub: 'Personal recommendation',  icon: '→' },
  { value: 'Colleague',    label: 'A colleague',    sub: 'Work or study circle',     icon: '⇄' },
  { value: 'Search',       label: 'Search engine',  sub: 'Google, Bing, etc.',       icon: '⊕' },
  { value: 'Other',        label: 'Other',          sub: 'Somewhere else entirely',  icon: '∗' },
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  background: '#F4F1E9',
  border: '1px solid rgba(27,26,22,.16)',
  borderRadius: 4,
  fontSize: 15,
  color: '#1B1A16',
  outline: 'none',
  fontFamily: 'Instrument Sans, system-ui, sans-serif',
  transition: 'border-color .15s',
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#7C8A7E',
  display: 'block',
  marginBottom: 7,
}

function OptionCard({
  selected,
  onClick,
  icon,
  label,
  sub,
}: {
  selected: boolean
  onClick: () => void
  icon: string
  label: string
  sub: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 16px',
        background: selected ? 'rgba(44,93,79,.07)' : '#F4F1E9',
        border: selected ? '1px solid rgba(44,93,79,.45)' : '1px solid rgba(27,26,22,.13)',
        borderRadius: 5, cursor: 'pointer',
        transition: 'border-color .15s, background .15s',
        textAlign: 'left', width: '100%',
      }}
      onMouseOver={e => { if (!selected) e.currentTarget.style.borderColor = 'rgba(27,26,22,.28)' }}
      onMouseOut={e => { if (!selected) e.currentTarget.style.borderColor = 'rgba(27,26,22,.13)' }}
    >
      {/* Icon badge */}
      <span style={{
        width: 34, height: 34, borderRadius: 6, flexShrink: 0,
        background: selected ? 'rgba(44,93,79,.12)' : 'rgba(27,26,22,.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'IBM Plex Mono', fontSize: 13,
        color: selected ? '#2C5D4F' : '#7C8A7E',
        transition: 'background .15s, color .15s',
      }}>
        {icon}
      </span>
      {/* Text */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1B1A16' }}>{label}</div>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#7C8A7E', marginTop: 2 }}>{sub}</div>
      </div>
      {/* Radio dot */}
      <span style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
        border: selected ? '5px solid #2C5D4F' : '1.5px solid rgba(27,26,22,.22)',
        transition: 'border .15s',
      }} />
    </button>
  )
}

function NavButtons({
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled = false,
  isSubmit = false,
  loading = false,
}: {
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  isSubmit?: boolean
  loading?: boolean
}) {
  const active = !nextDisabled && !loading
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            flexShrink: 0, padding: '12px 18px',
            background: 'transparent', border: '1px solid rgba(27,26,22,.18)',
            borderRadius: 4, fontSize: 15, fontFamily: 'Instrument Sans', fontWeight: 600,
            color: '#5B5A52', cursor: 'pointer', transition: 'border-color .15s',
          }}
          onMouseOver={e => (e.currentTarget.style.borderColor = 'rgba(27,26,22,.38)')}
          onMouseOut={e => (e.currentTarget.style.borderColor = 'rgba(27,26,22,.18)')}
        >
          ← Back
        </button>
      )}
      <button
        type={isSubmit ? 'submit' : 'button'}
        onClick={!isSubmit ? onNext : undefined}
        disabled={!active}
        style={{
          flex: 1, padding: '12px 18px',
          background: active ? '#2C5D4F' : 'rgba(27,26,22,.12)',
          color: active ? '#F4F1E9' : '#9AA69C',
          border: 'none', borderRadius: 4,
          fontSize: 15, fontFamily: 'Instrument Sans', fontWeight: 600,
          cursor: active ? 'pointer' : 'not-allowed',
          transition: 'background .18s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
        onMouseOver={e => { if (active) e.currentTarget.style.background = '#234c40' }}
        onMouseOut={e => { if (active) e.currentTarget.style.background = active ? '#2C5D4F' : 'rgba(27,26,22,.12)' }}
      >
        {loading ? 'Setting up your space…' : <>{nextLabel} <span>→</span></>}
      </button>
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  

  // Form states
  const [fullName, setFullName]             = useState('')
  const [username, setUsername]             = useState('')
  const [primaryRole, setPrimaryRole]       = useState('')
  const [domainOfFocus, setDomainOfFocus]   = useState('')
  const [referralSource, setReferralSource] = useState('')

  // UX states
  const [step, setStep]       = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)


  const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'taken' | 'available'>('idle')
  const [usernameTimer, setUsernameTimer] = useState<ReturnType<typeof setTimeout> | null>(null)


 const handleUsernameChange = (val: string) => {
  // Force lowercase immediately — mirrors DB constraint ^[a-z0-9_]+$
  const lowered = val.toLowerCase()
  setUsername(lowered)
  setUsernameState('idle')

  if (usernameTimer) clearTimeout(usernameTimer)
  if (lowered.trim().length < 3) return
  const timer = setTimeout(async () => {
    setUsernameState('checking')

    try {
     
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(lowered)}`)

      if (!res.ok) throw new Error("Network validation error")

      const data = await res.json()

      if (data.is_taken) {
        setUsernameState('taken')
      } else {
        setUsernameState('available')
      }
    } catch (error) {
      console.error('Username verification failed:', error)
      setUsernameState('idle') // Reset to idle smoothly on failure
    }
  }, 500)
  setUsernameTimer(timer)
}

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)
  setError(null)
  try {
    const res = await fetch("/api/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName.trim(),
        username: username.trim().toLowerCase(),
        primary_role: primaryRole,
        domain_of_focus: domainOfFocus,
        referral_source: referralSource,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      if (res.status === 401) {
        setError(data.detail || 'Your session has expired. Please log in again.')
      } else if (res.status === 409) {
        setError(data.detail || 'This username is already taken. Please choose another.')
        setStep(0) // Rollback to username step view if using multi-step system
      } else {
        throw new Error(data.detail || "Profile registration failed.")
      }
      return
    }
    router.push('/dashboard')
  } catch (err: any) {
    console.error("Profile submission error:", err)
    setError(err.message || 'An unexpected server error occurred.')
  } finally {
    setLoading(false)
  }
}

  const canAdvanceStep0 =
    fullName.trim().length >= 2 &&
    username.trim().length >= 3 &&
    /^[a-z0-9_]+$/.test(username) &&   // matches DB: ^[a-z0-9_]+$
    usernameState === 'available'

  const canAdvanceStep1 = primaryRole !== ''
  const canAdvanceStep2 = domainOfFocus !== ''
  const canSubmit       = referralSource !== ''

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&family=Newsreader:ital,wght@0,400;1,400&display=swap');
        body { margin: 0; background: #F4F1E9; font-family: 'Instrument Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        * { box-sizing: border-box; }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #F4F1E9 inset !important;
          -webkit-text-fill-color: #1B1A16 !important;
        }
      `}</style>

      <div style={{
        position: 'relative', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#F4F1E9', padding: '48px 20px', overflow: 'hidden',
      }}>
        <ContourBg />

        {/* Brand */}
        <div style={{
          position: 'absolute', top: 28, left: 40,
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: 'Newsreader', fontSize: 20, letterSpacing: '-0.03em', color: '#1B1A16',
        }}>
          <Glyph size={24} />
          <span style={{ fontWeight: 500 }}>atlas<span style={{ color: '#2C5D4F' }}>.ai</span></span>
        </div>

        {/* Step counter */}
        <div style={{
          position: 'absolute', top: 34, right: 40,
          fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#9AA69C', letterSpacing: '0.08em',
        }}>
          {step + 1} / {STEP_LABELS.length}
        </div>

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 480 }}>

          {/* Plate label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#2C5D4F', fontWeight: 500 }}>
              0{step + 1}
            </span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7C8A7E' }}>
              {STEP_LABELS[step]}
            </span>
            <span style={{ height: 1, flex: 1, background: 'rgba(27,26,22,.14)' }} />
          </div>

          {/* Progress bar */}
          <div style={{ height: 2, background: 'rgba(27,26,22,.1)', borderRadius: 2, marginBottom: 26, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: '#2C5D4F', borderRadius: 2,
              width: `${((step + 1) / STEP_LABELS.length) * 100}%`,
              transition: 'width .4s ease',
            }} />
          </div>

          {/* Step dots */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 28, justifyContent: 'center' }}>
            {STEP_LABELS.map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: i === step ? 22 : 7, height: 7, borderRadius: 4,
                  background: i < step ? '#2C5D4F' : i === step ? '#2C5D4F' : 'rgba(27,26,22,.14)',
                  transition: 'all .3s ease',
                }} />
              </div>
            ))}
          </div>

          {/* Card */}
          <div style={{
            background: '#FBFAF6',
            border: '1px solid rgba(27,26,22,.13)',
            borderRadius: 8,
            boxShadow: '0 1px 0 rgba(27,26,22,.04), 0 24px 56px -28px rgba(27,26,22,.2)',
            padding: '40px 40px 36px',
          }}>

            {/* ── STEP 0: Identity ── */}
            {step === 0 && (
              <>
                <h1 style={{ fontFamily: 'Newsreader', fontSize: 32, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1, color: '#1B1A16', margin: '0 0 6px' }}>
                  Set up your identity.
                </h1>
                <p style={{ fontSize: 15, color: '#5B5A52', margin: '0 0 30px' }}>
                  This is how Atlas knows you.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Full name */}
                  <div>
                    <label style={labelStyle}>Full name</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={50}
                      placeholder="e.g. Alex Rivera"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#2C5D4F')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(27,26,22,.16)')}
                    />
                  </div>

                  {/* Username */}
                  <div>
                    <label style={labelStyle}>Username</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{
                        position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                        fontFamily: 'IBM Plex Mono', fontSize: 14, color: '#9AA69C', pointerEvents: 'none',
                      }}>@</span>
                      <input
                        type="text"
                        required
                        minLength={3}
                        maxLength={20}
                        pattern="^[a-z0-9_]+$"
                        placeholder="alex_learns"
                        value={username}
                        onChange={e => handleUsernameChange(e.target.value)}
                        style={{
                          ...inputStyle,
                          paddingLeft: 28,
                          borderColor:
                            usernameState === 'taken' ? '#B5623C'
                            : usernameState === 'available' ? '#2C5D4F'
                            : 'rgba(27,26,22,.16)',
                        }}
                        onFocus={e => { if (usernameState === 'idle') e.target.style.borderColor = '#2C5D4F' }}
                        onBlur={e => { if (usernameState === 'idle') e.target.style.borderColor = 'rgba(27,26,22,.16)' }}
                      />
                    </div>

                    {/* Live rule checklist — mirrors DB constraint ^[a-z0-9_]+$ */}
                    {(() => {
                      const u = username
                      const hasMinLen    = u.length >= 3
                      const allLower     = u.length > 0 && !/[A-Z]/.test(u)
                      const validChars   = u.length > 0 && /^[a-z0-9_]+$/.test(u)
                     

                      const Rule = ({ pass, text }: { pass: boolean; text: string }) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{
                            width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: u.length === 0
                              ? 'rgba(27,26,22,.1)'
                              : pass ? 'rgba(44,93,79,.15)' : 'rgba(181,98,60,.15)',
                            fontSize: 8, fontWeight: 700,
                            color: u.length === 0 ? '#9AA69C' : pass ? '#2C5D4F' : '#B5623C',
                            transition: 'all .2s',
                          }}>
                            {u.length === 0 ? '·' : pass ? '✓' : '✕'}
                          </span>
                          <span style={{
                            fontFamily: 'IBM Plex Mono', fontSize: 11,
                            color: u.length === 0 ? '#9AA69C' : pass ? '#2C5D4F' : '#B5623C',
                            transition: 'color .2s',
                          }}>
                            {text}
                          </span>
                        </div>
                      )

                      return (
                        <div style={{
                          marginTop: 10,
                          padding: '10px 12px',
                          background: 'rgba(27,26,22,.04)',
                          border: '1px solid rgba(27,26,22,.09)',
                          borderRadius: 4,
                          display: 'flex', flexDirection: 'column', gap: 6,
                        }}>
                          <Rule pass={hasMinLen}   text="At least 3 characters" />
                          <Rule pass={allLower}    text="Lowercase only — no uppercase letters" />
                          <Rule pass={validChars}  text="Letters (a–z), numbers (0–9), underscores (_)" />
                        
                        </div>
                      )
                    })()}

                    {/* Availability status */}
                    {username.length >= 3 && /^[a-z0-9_]+$/.test(username) && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {usernameState === 'checking' && (
                          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#9AA69C' }}>
                            Checking availability…
                          </span>
                        )}
                        {usernameState === 'taken' && (
                          <>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#B5623C', flexShrink: 0 }} />
                            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#B5623C' }}>
                              Username taken — try another
                            </span>
                          </>
                        )}
                        {usernameState === 'available' && (
                          <>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2C5D4F', flexShrink: 0 }} />
                            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#2C5D4F' }}>
                              Available
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <NavButtons
                  nextDisabled={!canAdvanceStep0}
                  onNext={() => setStep(1)}
                />
              </>
            )}

            {/* ── STEP 1: Role ── */}
            {step === 1 && (
              <>
                <h1 style={{ fontFamily: 'Newsreader', fontSize: 32, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1, color: '#1B1A16', margin: '0 0 6px' }}>
                  How do you learn?
                </h1>
                <p style={{ fontSize: 15, color: '#5B5A52', margin: '0 0 26px' }}>
                  Atlas adapts to your context.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ROLES.map(r => (
                    <OptionCard
                      key={r.value}
                      selected={primaryRole === r.value}
                      onClick={() => setPrimaryRole(r.value)}
                      icon={r.icon}
                      label={r.label}
                      sub={r.sub}
                    />
                  ))}
                </div>

                <NavButtons
                  onBack={() => setStep(0)}
                  nextDisabled={!canAdvanceStep1}
                  onNext={() => setStep(2)}
                />
              </>
            )}

            {/* ── STEP 2: Domain ── */}
            {step === 2 && (
              <>
                <h1 style={{ fontFamily: 'Newsreader', fontSize: 32, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1, color: '#1B1A16', margin: '0 0 6px' }}>
                  What do you study?
                </h1>
                <p style={{ fontSize: 15, color: '#5B5A52', margin: '0 0 26px' }}>
                  Your primary domain shapes how Atlas organises your memory.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {DOMAINS.map(d => (
                    <OptionCard
                      key={d.value}
                      selected={domainOfFocus === d.value}
                      onClick={() => setDomainOfFocus(d.value)}
                      icon={d.icon}
                      label={d.label}
                      sub={d.sub}
                    />
                  ))}
                </div>

                <NavButtons
                  onBack={() => setStep(1)}
                  nextDisabled={!canAdvanceStep2}
                  onNext={() => setStep(3)}
                />
              </>
            )}

            {/* ── STEP 3: Discovery ── */}
            {step === 3 && (
              <form onSubmit={handleSubmit}>
                <h1 style={{ fontFamily: 'Newsreader', fontSize: 32, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1, color: '#1B1A16', margin: '0 0 6px' }}>
                  How did you find us?
                </h1>
                <p style={{ fontSize: 15, color: '#5B5A52', margin: '0 0 26px' }}>
                  Helps us understand where our community comes from.
                </p>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                }}>
                  {REFERRAL_SOURCES.map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setReferralSource(s.value)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                        gap: 8, padding: '14px 14px',
                        background: referralSource === s.value ? 'rgba(44,93,79,.07)' : '#F4F1E9',
                        border: referralSource === s.value ? '1px solid rgba(44,93,79,.45)' : '1px solid rgba(27,26,22,.13)',
                        borderRadius: 5, cursor: 'pointer',
                        transition: 'border-color .15s, background .15s',
                        textAlign: 'left',
                      }}
                      onMouseOver={e => { if (referralSource !== s.value) e.currentTarget.style.borderColor = 'rgba(27,26,22,.28)' }}
                      onMouseOut={e => { if (referralSource !== s.value) e.currentTarget.style.borderColor = 'rgba(27,26,22,.13)' }}
                    >
                      <span style={{
                        width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                        background: referralSource === s.value ? 'rgba(44,93,79,.12)' : 'rgba(27,26,22,.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'IBM Plex Mono', fontSize: 12,
                        color: referralSource === s.value ? '#2C5D4F' : '#7C8A7E',
                        transition: 'background .15s, color .15s',
                      }}>
                        {s.icon}
                      </span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1B1A16', lineHeight: 1.2 }}>{s.label}</div>
                        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10.5, color: '#7C8A7E', marginTop: 2, lineHeight: 1.4 }}>{s.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {error && (
                  <div style={{
                    marginTop: 18, padding: '11px 14px',
                    background: 'rgba(181,98,60,.07)',
                    border: '1px solid rgba(181,98,60,.25)',
                    borderRadius: 4,
                    fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#B5623C',
                  }}>
                    {error}
                  </div>
                )}

                {/* Workspace summary */}
                <div style={{
                  marginTop: 24, padding: '13px 15px',
                  background: '#F4F1E9', border: '1px solid rgba(27,26,22,.1)',
                  borderRadius: 5,
                }}>
                  <span style={{
                    fontFamily: 'IBM Plex Mono', fontSize: 10.5,
                    letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9AA69C',
                  }}>
                    Your workspace
                  </span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#2C5D4F' }}>
                      @{username.toLowerCase()}
                    </span>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#9AA69C' }}>·</span>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#5B5A52' }}>{primaryRole}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#9AA69C' }}>·</span>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#5B5A52' }}>{domainOfFocus}</span>
                  </div>
                </div>

                <NavButtons
                  onBack={() => setStep(2)}
                  nextLabel="Activate workspace"
                  nextDisabled={!canSubmit}
                  isSubmit
                  loading={loading}
                />
              </form>
            )}

          </div>

          <p style={{ marginTop: 20, textAlign: 'center', fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#9AA69C', letterSpacing: '0.06em' }}>
            © {new Date().getFullYear()} Atlas.ai · Your AI learning memory
          </p>
        </div>
      </div>
    </>
  )
}
