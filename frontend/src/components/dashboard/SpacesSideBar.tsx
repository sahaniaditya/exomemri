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
          Learning Spaces
        </div>
        <nav className={styles.nav}>
          {spaces.length === 0 ? (
            <span className={styles.navitem} style={{ color: '#7C8A7E' }}>
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
                  {space.name}
                  {space.source_counts.total ? (
                    <span className={styles.ct}>{space.source_counts.total}</span>
                  ) : null}
                </Link>
              )
            })
          )}
        </nav>
      </div>

      {/* The map is scoped to whichever space is open, so it lives here rather
          than in the global nav. */}
      <div className={styles.navsec}>
        <nav className={styles.nav}>
          <Link className={styles.navitem} href={`/dashboard/spaces/${activeSpaceId}/map`}>
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
    </aside>
  )
}