'use client'
import Link from 'next/link'
import styles from './dashboard.module.css'
import Glyph from './Glyph'
import { SOURCE_GLYPH } from '@/lib/dashboard-data'
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
        <Glyph size={24} />
        <span>
          <span className={styles.wordmark}>atlas</span>
          <span style={{ color: '#2C5D4F' }}>.ai</span>
        </span>
      </Link>

      <Link href={`/dashboard/spaces/${space.id}`} className={styles.navitem} style={{ marginBottom: 8 }}>
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {space.name}
      </Link>

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
          Sources
        </div>
        <nav className={styles.nav}>
          {sources.length === 0 ? (
            <span className={styles.navitem} style={{ color: '#7C8A7E' }}>
              No sources yet
            </span>
          ) : (
            sources.map(source => {
              const isActive = source.id === activeSourceId
              return (
                <Link
                  key={source.id}
                  className={`${styles.navitem} ${isActive ? styles.on : ''}`}
                  href={`/dashboard/spaces/${space.id}/sources/${source.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  title={source.title}
                >
                  <span aria-hidden="true">{GLYPH_BY_TYPE[source.type]}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {source.title}
                  </span>
                </Link>
              )
            })
          )}
        </nav>
      </div>

      <div className={styles.spacer} />
    </aside>
  )
}