'use client'
import Link from 'next/link'
import styles from './dashboard.module.css'
import { Lockup } from '@/components/brand/Lockup'
import { SOURCE_GLYPH } from '@/lib/dashboard-data'
import OriginalLink from './OriginalLink'
import type { Source, Space } from '@/lib/spaces'

interface SourceSidebarProps {
  space: Space
  sources: Source[]
  activeSourceId: string
}

const GLYPH_BY_TYPE: Record<Source['type'], string> = {
  youtube: SOURCE_GLYPH.video,
  article: SOURCE_GLYPH.article,
  pdf: SOURCE_GLYPH.pdf,
  ai_chat: SOURCE_GLYPH.chat,
  note: SOURCE_GLYPH.note,
}

export default function SourceSidebar({ space, sources, activeSourceId }: SourceSidebarProps) {
  return (
    <aside className={styles.side}>
      <Link className={styles.brand} href="/dashboard">
        <Lockup size={24} />
      </Link>

      <Link href={`/dashboard/spaces/${space.id}`} className={styles.navitem} style={{ marginBottom: 8 }}>
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {space.name}
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
    </aside>
  )
}
