import Link from 'next/link'
import styles from './dashboard.module.css'
import type { SharedSpaceSummary } from '@/lib/sharing'

export default function SharedWithMeList({ spaces }: { spaces: SharedSpaceSummary[] }) {
  return (
    <div className={styles.chips}>
      {spaces.map(space => (
        <Link
          key={space.id}
          href={`/dashboard/shared/${space.id}`}
          className={styles.chip}
        >
          {space.name}
          {space.owner_username && ` · ${space.owner_username}`}
        </Link>
      ))}
    </div>
  )
}
