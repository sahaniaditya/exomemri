import { type CapturedSource } from '@/lib/dashboard-data'
import styles from './dashboard.module.css'
import Link from 'next/link'
import SourceIcon from './SourceIcon'

export default function CaptureFeed({ sources }: { sources: CapturedSource[] }) {
  if (sources.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.et}>No captures yet</div>
        <p>Highlight anything in the browser extension and it lands here.</p>
      </div>
    )
  }

  return (
    <div className={styles.feed}>
      {sources.map(source => (
        <Link
          href={`/dashboard/spaces/${source.spaceId}/sources/${source.id}`}
          key={source.id}
        >
          <div className={styles.src}>
            <div className={styles.srcico} aria-hidden="true">
              <SourceIcon kind={source.kind} size={16} />
            </div>
            <div className={styles.srcmain}>
              <div className={styles.srctitle}>{source.title}</div>
              <div className={styles.srcmeta}>
                <span className={styles.tag}>{source.spaceName}</span> ·{' '}
                <span>{source.meta}</span> · <span>{source.capturedAt}</span>
              </div>
            </div>
            {source.status === 'summarizing' && (
              <span className={`${styles.status} ${styles.wip}`}>
                <span className={styles.statusDot} aria-hidden="true" />
                Processing
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
