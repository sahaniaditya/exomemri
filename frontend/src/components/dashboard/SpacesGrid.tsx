import { type LearningSpace } from '@/lib/dashboard-data'
import styles from './dashboard.module.css'
import Link from 'next/link'
import CoverageRing from './CoverageRing'
import NewSpaceTile from './NewSpaceTile'
import SourceIcon from './SourceIcon'

const KIND_ORDER = ['video', 'article', 'pdf', 'chat', 'note'] as const

const KIND_LABEL: Record<(typeof KIND_ORDER)[number], string> = {
  video: 'Video',
  article: 'Article',
  pdf: 'PDF',
  chat: 'Chat',
  note: 'Note',
}

export default function SpacesGrid({ spaces }: { spaces: LearningSpace[] }) {
  return (
    <div className={styles.spaces}>
      {spaces.map((space, index) => {
        const total = KIND_ORDER.reduce((sum, kind) => sum + space.counts[kind], 0)
        const kinds = KIND_ORDER.filter(kind => space.counts[kind] > 0)
        return (
          <article
            className={styles.space}
            key={space.id}
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <div className={styles.spaceAccent} aria-hidden="true" />
            <Link
              href={`/dashboard/spaces/${space.id}`}
              className={styles.spaceMain}
              aria-label={space.name}
            >
              <span className={styles.spaceHit} aria-hidden="true" />
            </Link>
            <div className={styles.shead}>
              <div>
                <div className={styles.spaceIndex}>
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className={styles.stitle}>{space.name}</div>
              </div>
              <CoverageRing
                spaceId={space.id}
                spaceName={space.name}
                initialCoverage={space.coverage}
              />
            </div>

            <div className={styles.styp}>
              {total === 0 ? (
                <span className={styles.stypEmpty}>No sources yet</span>
              ) : (
                kinds.map(kind => (
                  <span key={kind} className={styles.kindChip}>
                    <SourceIcon kind={kind} />
                    {space.counts[kind]} {KIND_LABEL[kind]}
                  </span>
                ))
              )}
            </div>

            <div className={styles.sfoot}>
              <span>
                {total} {total === 1 ? 'source' : 'sources'}
              </span>
              <span>{space.lastActive}</span>
            </div>
          </article>
        )
      })}
      <NewSpaceTile />
    </div>
  )
}
