'use client'
import { useRouter } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { clearExtensionSession } from '@/lib/extension-session'
import { initial, type Profile } from '@/lib/profile'
import styles from './dashboard.module.css'

interface TopBarProps {
  profile: Profile | null
  totalSources: number
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

// Greeting and date depend on the viewer's clock and timezone, so the server
// render stays neutral and the real values arrive on hydration. The snapshot is
// memoised because useSyncExternalStore compares it by identity.
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

export default function TopBar({ profile, totalSources }: TopBarProps) {
  const router = useRouter()
  const clock = useSyncExternalStore<Clock | null>(subscribe, getClientClock, () => null)
  const name = profile?.full_name?.split(' ')[0] ?? 'there'

  const handleLogout = async () => {
    try {
      // The route reads the httpOnly cookie server-side, tells FastAPI to
      // destroy the session, and clears both cookies — none of which
      // client JS can do for httpOnly cookies on its own.
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      // The extension mirror lives in localStorage, so the client clears it.
      clearExtensionSession()
      router.push('/login')
    }
  }

  return (
    <div className={styles.top}>
      <div className={styles.hello}>
        <div className={styles.coord}>{clock?.date ?? ''}</div>
        <h1>{clock ? `${clock.greeting}, ${name}.` : `Welcome back, ${name}.`}</h1>
      </div>

      <div className={styles.me}>
        <div className={styles.avatar}>{initial(profile)}</div>
        <div>
          <div className={styles.nm}>{profile?.full_name ?? 'Your account'}</div>
          <div className={styles.pl}>{totalSources} SOURCES</div>
        </div>
        <button
          type="button"
          className={styles.signout}
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
        >
          <svg viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </div>
  )
}