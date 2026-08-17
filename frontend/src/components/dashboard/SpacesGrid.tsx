import { type LearningSpace } from '@/lib/dashboard-data'
import styles from './dashboard.module.css'
import Link from 'next/link'
import NewSpaceTile from './NewSpaceTile'
import PlayButton from './PlayButton'
import SourceIcon from './SourceIcon'

const KIND_ORDER = ['video', 'article', 'pdf', 'chat', 'note'] as const

export default function SpacesGrid({ spaces }: { spaces: LearningSpace[] }) {
  return (
    <div className={styles.spaces}>
      {spaces.map(space => {
        const total = KIND_ORDER.reduce((sum, kind) => sum + space.counts[kind], 0)
        return (
          <Link href={`/dashboard/spaces/${space.id}`} className={styles.space} key={space.id}>
            <div className={styles.shead}>
              <div className={styles.stitle}>{space.name}</div>
              <PlayButton ariaLabel={`Open ${space.name}`} />
            </div>
            <div className={styles.styp}>
              {total === 0 ? (
                <span className={styles.stypEmpty}>No sources yet</span>
              ) : (
                KIND_ORDER.filter(kind => space.counts[kind] > 0).map(kind => (
                  <span key={kind}>
                    <SourceIcon kind={kind} /> {space.counts[kind]}
                  </span>
                ))
              )}
            </div>
            <div className={styles.sfoot}>
              <span>{total} {total === 1 ? 'source' : 'sources'}</span>
              <span>{space.lastActive}</span>
            </div>
          </Link>
        )
      })}
      <NewSpaceTile />
    </div>
  )
}