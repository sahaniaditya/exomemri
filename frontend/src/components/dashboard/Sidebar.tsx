'use client'
import Link from 'next/link'
import styles from './dashboard.module.css'
import Glyph from './Glyph'

interface SidebarProps {
  spaceCount: number
  sourceCount: number
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
    href: '/dashboard/sources',
    label: 'Recent Captures',
    key: 'sources',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
        <rect x="3" y="4" width="7" height="7" rx="1" />
        <rect x="14" y="4" width="7" height="7" rx="1" />
        <rect x="3" y="15" width="7" height="5" rx="1" />
        <rect x="14" y="15" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  // {
  //   href: '/dashboard/ask',
  //   label: 'Ask memory',
  //   icon: (
  //     <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
  //       <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  //     </svg>
  //   ),
  // },
] as const

export default function Sidebar({ spaceCount,sourceCount }: SidebarProps) {
  const counts: Record<string, number> = { spaces: spaceCount, sources:sourceCount }

  return (
    <aside className={styles.side}>
      <Link className={styles.brand} href="/dashboard">
        <Glyph size={24} />
        <span>
          <span className={styles.wordmark}>atlas</span>
          <span style={{ color: '#2C5D4F' }}>.ai</span>
        </span>
      </Link>

      {/* <button type="button" className={styles.newbtn}>
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
      </button> */}

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
    </aside>
  )
}