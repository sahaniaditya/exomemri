import { SOURCE_GLYPH, type CapturedSource } from '@/lib/dashboard-data'
import styles from './dashboard.module.css'
import Link from 'next/link'

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
        <Link href={`/dashboard/spaces/${source.spaceId}/sources/${source.id}`}>
            <div className={styles.src} key={source.id}>
          <div className={styles.srcico} aria-hidden="true">
            {SOURCE_GLYPH[source.kind]}
          </div>
          <div className={styles.srcmain}>
            <div className={styles.srctitle}>{source.title}</div>
            <div className={styles.srcmeta}>
              <span className={styles.tag}>{source.spaceName}</span> ·{' '}
              <span>{source.meta}</span> · <span>{source.capturedAt}</span>
            </div>
          </div>
          <span
            className={`${styles.status} ${
              source.status === 'summarized' ? styles.done : styles.wip
            }`}
          >
            {/* {source.status === 'summarized' ? 'Summarized' : 'Summarizing'} */}
          </span>
        </div>
        </Link>
        
      ))}
    </div>
  )
}
