'use client'
import Link from 'next/link'
import type { CreditsBalance } from '@/lib/credits'
import { SOURCE_GLYPH } from '@/lib/dashboard-data'
import type { Profile } from '@/lib/profile'
import type { Source, Space } from '@/lib/spaces'
import AccountChrome from './AccountChrome'
import OriginalLink from './OriginalLink'
import SideChrome from './SideChrome'
import styles from './dashboard.module.css'

interface SourceSidebarProps {
  space: Space
  sources: Source[]
  activeSourceId: string
  profile?: Profile | null
  streakDays?: number
  credits?: CreditsBalance | null
}

const GLYPH_BY_TYPE: Record<Source['type'], string> = {
  youtube: SOURCE_GLYPH.video,
  article: SOURCE_GLYPH.article,
  pdf: SOURCE_GLYPH.pdf,
  ai_chat: SOURCE_GLYPH.chat,
  note: SOURCE_GLYPH.note,
}

export default function SourceSidebar({
  space,
  sources,
  activeSourceId,
  profile = null,
  streakDays = 0,
  credits = null,
}: SourceSidebarProps) {
  return (
    <SideChrome
      account={
        <AccountChrome profile={profile} streakDays={streakDays} credits={credits} />
      }
    >
      <Link href={`/dashboard/spaces/${space.id}`} className={styles.navitem}>
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className={styles.navitemLabel}>{space.name}</span>
      </Link>

      <div className={styles.navsec}>
        <div className={styles.navlabel}>Sources</div>
        <nav className={styles.nav} aria-label="Sources">
          {sources.length === 0 ? (
            <span className={styles.navitem} style={{ color: 'var(--sage)' }}>
              No sources yet
            </span>
          ) : (
            sources.map(source => {
              const isActive = source.id === activeSourceId
              return (
                <div
                  key={source.id}
                  className={`${styles.sourceNavRow} ${isActive ? styles.sourceNavRowOn : ''}`}
                >
                  <Link
                    className={styles.sourceNavLink}
                    href={`/dashboard/spaces/${space.id}/sources/${source.id}`}
                    aria-current={isActive ? 'page' : undefined}
                    title={source.title}
                  >
                    <span aria-hidden="true">{GLYPH_BY_TYPE[source.type]}</span>
                    <span className={styles.sourceNavTitle}>{source.title}</span>
                  </Link>
                  {source.url ? <OriginalLink url={source.url} compact /> : null}
                </div>
              )
            })
          )}
        </nav>
      </div>

      <div className={styles.spacer} />
    </SideChrome>
  )
}
