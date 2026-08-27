import Link from 'next/link'
import styles from './dashboard.module.css'
import type { SharedSourceSummary } from '@/lib/sharing'

export default function SharedWithMeList({
  sources,
}: {
  sources: SharedSourceSummary[]
}) {
  return (
    <div className={styles.chips}>
      {sources.map(source => (
        <Link
          key={source.source_id}
          href={`/dashboard/shared/sources/${source.source_id}`}
          className={styles.chip}
        >
          {source.title}
          {source.owner_username && ` · ${source.owner_username}`}
        </Link>
      ))}
    </div>
  )
}
