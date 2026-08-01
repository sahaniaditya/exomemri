'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { clearExtensionSession } from '@/lib/extension-session'
import { initial, type Profile } from '@/lib/profile'
import styles from './dashboard.module.css'
import Glyph from './Glyph'

interface SidebarProps {
  profile: Profile | null
  spaceCount: number
  reviewCount: number
  totalSources: number
  plan: string
  extensionTabs: number
}

const NAV = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
        <path d="M3 12l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    href: '/dashboard/spaces',
    label: 'Learning Spaces',
    key: 'spaces',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
        <rect x="3" y="4" width="7" height="7" rx="1" />
        <rect x="14" y="4" width="7" height="7" rx="1" />
        <rect x="3" y="15" width="7" height="5" rx="1" />
        <rect x="14" y="15" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    href: '/dashboard/ask',
    label: 'Ask memory',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
        <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/review',
    label: 'Review',
    key: 'review',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
        <path d="M9 11l3 3 8-8" />
        <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
      </svg>
    ),
  },
  {
    href: '/dashboard/timeline',
    label: 'Timeline',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
        <path d="M12 8v4l3 2" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
] as const

export default function Sidebar({
  profile,
  spaceCount,
  reviewCount,
  totalSources,
  plan,
  extensionTabs,
}: SidebarProps) {
  const router = useRouter()

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

  const counts: Record<string, number> = { spaces: spaceCount, review: reviewCount }

  return (
    <aside className={styles.side}>
      <Link className={styles.brand} href="/dashboard">
        <Glyph size={24} />
        <span>
          <span className={styles.wordmark}>atlas</span>
          <span style={{ color: '#2C5D4F' }}>.ai</span>
        </span>
      </Link>

      <button type="button" className={styles.newbtn}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Capture
      </button>

      <div className={styles.navsec}>
        <div
          className={styles.navlabel}
          style={{
            fontFamily: 'var(--font-ibm-plex-mono), monospace',
            fontSize: 11,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            color: '#7C8A7E',
          }}
        >
          Workspace
        </div>
        <nav className={styles.nav}>
          {NAV.map(item => {
            const isActive = item.href === '/dashboard'
            const count = 'key' in item ? counts[item.key] : undefined
            const body = (
              <>
                {item.icon}
                {item.label}
                {count ? <span className={styles.ct}>{count}</span> : null}
              </>
            )
            // Only Overview has a route today; the rest stay inert rather than
            // linking to a 404 until their pages land.
            return isActive ? (
              <Link
                key={item.href}
                className={`${styles.navitem} ${styles.on}`}
                href={item.href}
                aria-current="page"
              >
                {body}
              </Link>
            ) : (
              <span
                key={item.href}
                className={styles.navitem}
                role="link"
                aria-disabled="true"
                title="Coming soon"
              >
                {body}
              </span>
            )
          })}
        </nav>
      </div>

      <div className={styles.spacer} />

      <div className={styles.ext}>
        <div className={styles.st}>
          <span className={styles.dot} /> Browser extension active
        </div>
        <p>
          Capturing on {extensionTabs} tabs. Highlight anything to save it here.
        </p>
      </div>

      <div className={styles.me}>
        <div className={styles.avatar}>{initial(profile)}</div>
        <div>
          <div className={styles.nm}>{profile?.full_name ?? 'Your account'}</div>
          <div className={styles.pl}>
            {plan} · {totalSources} SOURCES
          </div>
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
    </aside>
  )
}
