'use client'
import { useRouter } from 'next/navigation'
import { SOURCE_GLYPH, type LearningSpace } from '@/lib/dashboard-data'
import styles from './dashboard.module.css'
import CoverageRing from './CoverageRing'
import NewSpaceTile from './NewSpaceTile'
import PlayButton from './PlayButton'

export default function SpacesGrid({ spaces }: { spaces: LearningSpace[] }) {
  const router = useRouter()

  return (
    <div className={styles.spaces}>
      {spaces.map(space => (
        <div className={styles.space} key={space.id}>
          <div className={styles.shead}>
            <div className={styles.stitle}>{space.name}</div>
            {/* <CoverageRing pct={space.coverage} /> */}
            <button
              type="button"
              onClick={() => router.push(`/dashboard/spaces/${space.id}`)}
              aria-label={`Open ${space.name}`}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <PlayButton />
            </button>
          </div>
          <div className={styles.styp}>
            <span>{SOURCE_GLYPH.video} {space.counts.video}</span>
            <span>{SOURCE_GLYPH.article} {space.counts.article}</span>
            <span>{SOURCE_GLYPH.pdf} {space.counts.pdf}</span>
            <span>{SOURCE_GLYPH.chat} {space.counts.chat}</span>
            <span>{SOURCE_GLYPH.note} {space.counts.note}</span>
          </div>
          <div className={styles.sfoot}>
            {/* <span className={styles.knownlbl}>{space.coverage}% KNOWN</span> */}
            <span>{space.lastActive}</span>
          </div>
        </div>
      ))}
      <NewSpaceTile />
    </div>
  )
}