'use client'
import Link from 'next/link'
import styles from './dashboard.module.css'
import { Lockup } from '@/components/brand/Lockup'

interface SidebarProps {
  spaceCount: number
  sourceCount: number
}

const NAV = [
  {
    href: '/dashboard',
    label: 'Overview',
    active: true,
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
    key: 'sources' as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    ),
  },
]

export default function Sidebar({ spaceCount, sourceCount }: SidebarProps) {
  const counts: Record<string, number> = { spaces: spaceCount, sources: sourceCount }

  return (
    <aside className={styles.side}>
      <Link className={styles.brand} href="/dashboard">
        <Lockup size={24} />
      </Link>

      <div className={styles.navsec}>
        <div className={styles.navlabel}>Workspace</div>
        <nav className={styles.nav} aria-label="Workspace">
          {NAV.map(item => {
            const count = 'key' in item && item.key ? counts[item.key] : undefined
            const isActive = 'active' in item && item.active
            return (
              <Link
                key={item.href}
                className={`${styles.navitem} ${isActive ? styles.on : ''}`}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.icon}
                {item.label}
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
    </aside>
  )
}
