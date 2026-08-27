'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { CreditsBalance } from '@/lib/credits'
import type { Profile } from '@/lib/profile'
import AccountChrome from './AccountChrome'
import SideChrome from './SideChrome'
import styles from './dashboard.module.css'

interface SidebarProps {
  spaceCount: number
  sourceCount: number
  profile?: Profile | null
  streakDays?: number
  credits?: CreditsBalance | null
}

const NAV = [
  {
    href: '/dashboard',
    label: 'Overview',
    short: 'Overview',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
        <path d="M3 12l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    href: '/dashboard#spaces',
    label: 'Learning Spaces',
    short: 'Spaces',
    key: 'spaces' as const,
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
    href: '/dashboard#captures',
    label: 'Recent Captures',
    short: 'Captures',
    key: 'sources' as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
  {
    href: '/dashboard/profile',
    label: 'Profile',
    short: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 19.5c1.2-3.2 3.7-5 7-5s5.8 1.8 7 5" />
      </svg>
    ),
  },
]

function isNavActive(href: string, pathname: string): boolean {
  const path = href.split('#')[0]
  if (path === '/dashboard') return pathname === '/dashboard'
  return pathname === path || pathname.startsWith(`${path}/`)
}

export default function Sidebar({
  spaceCount,
  sourceCount,
  profile = null,
  streakDays = 0,
  credits = null,
}: SidebarProps) {
  const pathname = usePathname()
  const counts: Record<string, number> = { spaces: spaceCount, sources: sourceCount }

  return (
    <SideChrome
      account={
        <AccountChrome profile={profile} streakDays={streakDays} credits={credits} />
      }
    >
      <div className={styles.navsec}>
        <div className={styles.navlabel}>Workspace</div>
        <nav className={styles.nav} aria-label="Workspace">
          {NAV.map(item => {
            const count = 'key' in item && item.key ? counts[item.key] : undefined
            const isActive = isNavActive(item.href, pathname)
            return (
              <Link
                key={item.href}
                className={`${styles.navitem} ${isActive ? styles.on : ''}`}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.icon}
                <span className={styles.navitemFull}>{item.label}</span>
                <span className={styles.navitemShort}>{item.short}</span>
                {count !== undefined ? <span className={styles.ct}>{count}</span> : null}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className={styles.spacer} />

      <div className={styles.ext}>
        <div className={styles.st}>
          <span className={styles.dot} aria-hidden="true" />
          Browser extension
        </div>
        <p>Capture videos, articles, and AI chats with one click while you browse.</p>
      </div>
    </SideChrome>
  )
}
