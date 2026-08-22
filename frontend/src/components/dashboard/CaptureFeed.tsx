import { type CapturedSource } from '@/lib/dashboard-data'
import styles from './dashboard.module.css'
import Link from 'next/link'
import SourceIcon from './SourceIcon'
import OriginalLink from './OriginalLink'

interface CaptureFeedProps {
  sources: CapturedSource[]
  /** Override empty-state copy for space-scoped feeds. */
  emptyTitle?: string
  emptyBody?: string
}

export default function CaptureFeed({
  sources,
  emptyTitle = 'No captures yet',
  emptyBody = 'Install the browser extension, open a video or article, and save it into a Learning Space — it will show up here.',
}: CaptureFeedProps) {
  if (sources.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.et}>{emptyTitle}</div>
        <p>{emptyBody}</p>
      </div>
    )
  }

  return (
    <div className={styles.feedPanel}>
      <div className={styles.feed}>
        {sources.map(source => (
          <div key={source.id} className={styles.srcRow}>
            <Link
              href={`/dashboard/spaces/${source.spaceId}/sources/${source.id}`}
              className={styles.srcLink}
            >
              <div className={styles.src}>
                <div className={styles.srcico} aria-hidden="true">
                  <SourceIcon kind={source.kind} size={16} />
                </div>
                <div className={styles.srcmain}>
                  <div className={styles.srctitle}>{source.title}</div>
                  <div className={styles.srcmeta}>
                    <span className={styles.tag}>{source.spaceName}</span>
                    <span className={styles.metaSep} aria-hidden="true">
                      ·
                    </span>
                    <span>{source.meta}</span>
                    <span className={styles.metaSep} aria-hidden="true">
                      ·
                    </span>
                    <span>{source.capturedAt}</span>
                  </div>
                </div>
                {source.status === 'summarizing' ? (
                  <span className={`${styles.status} ${styles.wip}`}>
                    <span className={styles.statusDot} aria-hidden="true" />
                    Processing
                  </span>
                ) : null}
              </div>
            </Link>
            <div className={styles.srcActions}>
              {source.url ? <OriginalLink url={source.url} /> : null}
              <Link
                href={`/dashboard/spaces/${source.spaceId}/sources/${source.id}`}
                className={styles.srcOpenInApp}
                aria-label={`Open ${source.title} in exomemri`}
              >
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
