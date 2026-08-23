'use client'
import Link from 'next/link'
import styles from './dashboard.module.css'
import { Lockup } from '@/components/brand/Lockup'
import type { Space } from '@/lib/spaces'

interface SpacesSidebarProps {
  spaces: Space[]
  activeSpaceId: string
}

export default function SpacesSidebar({ spaces, activeSpaceId }: SpacesSidebarProps) {
  return (
    <aside className={styles.side}>
      <Link className={styles.brand} href="/dashboard">
        <Lockup size={24} />
      </Link>

      <div className={styles.navsec}>
        <Link className={styles.navitem} href="/dashboard">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to overview
        </Link>
      </div>

      <div className={styles.navsec}>
        <div className={styles.navlabel}>Learning Spaces</div>
        <nav className={styles.nav} aria-label="Learning Spaces">
          {spaces.length === 0 ? (
            <span className={styles.navitem} style={{ color: 'var(--sage)' }}>
              No spaces yet
            </span>
          ) : (
            spaces.map(space => {
              const isActive = space.id === activeSpaceId
              return (
                <Link
                  key={space.id}
                  className={`${styles.navitem} ${isActive ? styles.on : ''}`}
                  href={`/dashboard/spaces/${space.id}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
                    <rect x="3" y="4" width="7" height="7" rx="1" />
                    <rect x="14" y="4" width="7" height="7" rx="1" />
                    <rect x="3" y="15" width="7" height="5" rx="1" />
                    <rect x="14" y="15" width="7" height="5" rx="1" />
                  </svg>
                  <span className={styles.navitemLabel}>{space.name}</span>
                  {space.source_counts.total ? (
                    <span className={styles.ct}>{space.source_counts.total}</span>
                  ) : null}
                </Link>
              )
            })
          )}
        </nav>
      </div>

      <div className={styles.navsec}>
        <div className={styles.navlabel}>In this space</div>
        <nav className={styles.nav} aria-label="Space tools">
          <Link
            className={`${styles.navitem} ${styles.on}`}
            href={`/dashboard/spaces/${activeSpaceId}`}
            aria-current="page"
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
            Captures
          </Link>
          <Link
            className={styles.navitem}
            href={`/dashboard/spaces/${activeSpaceId}/map`}
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
              <circle cx="6" cy="7" r="2.5" />
              <circle cx="18" cy="6" r="2.5" />
              <circle cx="12" cy="17" r="2.5" />
              <path d="M8.2 8.2 10.6 15M15.9 7.6 13.4 15M8.4 6.6h7.2" />
            </svg>
            Knowledge map
          </Link>
        </nav>
      </div>

      <div className={styles.spacer} />

      <div className={styles.ext}>
        <div className={styles.st}>
          <span className={styles.dot} aria-hidden="true" />
          Capture into this space
        </div>
        <p>
          Set it as active in the extension, then save videos, articles, and chats
          with one click.
        </p>
      </div>
    </aside>
  )
}
