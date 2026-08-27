'use client'
/**
 * Overview account chrome + greeting. Greeting/date are clock-local (see
 * useSyncExternalStore below); counts come from the server page.
 */
import { useSyncExternalStore } from 'react'
import { useLogout } from '@/lib/use-logout'
import { formatCredits, type CreditsBalance } from '@/lib/credits'
import { initial, type Profile } from '@/lib/profile'
import ThemeToggle from './ThemeToggle'
import styles from './dashboard.module.css'

interface TopBarProps {
  profile: Profile | null
  totalSources: number
  spaceCount: number
  /** Days of consecutive study activity (a capture, UTC days). */
  streakDays?: number
  credits?: CreditsBalance | null
  /** Full hero + pulse on overview; compact greeting elsewhere. */
  variant?: 'hero' | 'compact'
}

interface Clock {
  greeting: string
  date: string
}

function greetingFor(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

let clientClock: Clock | null = null
function getClientClock(): Clock {
  if (!clientClock) {
    const now = new Date()
    clientClock = {
      greeting: greetingFor(now.getHours()),
      date: now
        .toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
        .toUpperCase(),
    }
  }
  return clientClock
}

const subscribe = () => () => {}

export default function TopBar({
  profile,
  totalSources,
  spaceCount,
  streakDays = 0,
  credits = null,
  variant = 'hero',
}: TopBarProps) {
  const { logout, loggingOut } = useLogout()
  const clock = useSyncExternalStore<Clock | null>(subscribe, getClientClock, () => null)
  const name = profile?.full_name?.split(' ')[0] ?? 'there'
  const empty = totalSources === 0

  const account = (
    <div className={styles.me}>
      <div className={styles.avatar}>{initial(profile)}</div>
      <div>
        <div className={styles.nm}>{profile?.full_name ?? 'Your account'}</div>
        <div className={styles.pl}>
          {credits != null ? formatCredits(credits.balance) : 'SIGNED IN'}
        </div>
      </div>
      <button
        type="button"
        className={styles.signout}
        onClick={() => void logout()}
        disabled={loggingOut}
        title="Sign out"
        aria-label="Sign out"
      >
        <svg viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5M21 12H9" />
        </svg>
      </button>
    </div>
  )

  const streak = streakDays > 0 && (
    <div className={styles.streak}>
      <span className={styles.flame} aria-hidden="true">
        🔥
      </span>
      {streakDays} day{streakDays === 1 ? '' : 's'}
    </div>
  )

  if (variant === 'compact') {
    return (
      <div className={styles.top}>
        <div className={styles.hello}>
          <div className={styles.coord}>{clock?.date ?? '\u00a0'}</div>
          <h1>
            {clock ? `${clock.greeting}, ${name}.` : `Welcome back, ${name}.`}
          </h1>
          <p className={styles.sub}>
            {totalSources === 0
              ? 'Capture your first source to start building this space.'
              : `${totalSources} ${totalSources === 1 ? 'source' : 'sources'} across ${spaceCount} ${
                  spaceCount === 1 ? 'space' : 'spaces'
                }`}
          </p>
        </div>
        <div className={styles.topRight}>
          {streak}
          <ThemeToggle />
          {account}
        </div>
      </div>
    )
  }

  return (
    <header className={styles.hero}>
      <div className={styles.heroTop}>
        <div className={styles.hello}>
          <div className={styles.coord}>{clock?.date ?? '\u00a0'}</div>
          <h1>
            {clock ? `${clock.greeting}, ${name}.` : `Welcome back, ${name}.`}
          </h1>
          <p className={styles.sub}>
            {empty
              ? 'Your learning memory is empty — create a space and capture something worth keeping.'
              : 'Pick up a Learning Space, or scan what you captured most recently.'}
          </p>
        </div>
        <div className={styles.topRight}>
          {streak}
          <ThemeToggle />
          {account}
        </div>
      </div>
      <div className={styles.pulse} aria-label="Library at a glance">
        <div className={styles.pulseCard}>
          <div className={styles.pulseVal}>{spaceCount}</div>
          <div className={styles.pulseKey}>Learning Spaces</div>
          <div className={styles.pulseHint}>
            {spaceCount === 0 ? 'Create your first' : 'Topics you are building'}
          </div>
        </div>
        <div className={styles.pulseCard}>
          <div className={styles.pulseVal}>{totalSources}</div>
          <div className={styles.pulseKey}>Sources captured</div>
          <div className={styles.pulseHint}>
            {empty ? 'Waiting for your first save' : 'Across every space'}
          </div>
        </div>
        <a className={styles.pulseCta} href="#spaces">
          <span className={styles.pulseCtaEyebrow}>Next</span>
          <span className={styles.pulseCtaTitle}>
            {empty ? 'Start a Learning Space' : 'Browse your spaces'}
          </span>
          <span className={styles.pulseCtaArrow} aria-hidden="true">
            →
          </span>
        </a>
      </div>
    </header>
  )
}