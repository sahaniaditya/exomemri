import { SOURCE_GLYPH, type LearningSpace } from '@/lib/dashboard-data'
import styles from './dashboard.module.css'
import CoverageRing from './CoverageRing'
import NewSpaceTile from './NewSpaceTile'

export default function SpacesGrid({ spaces }: { spaces: LearningSpace[] }) {
  return (
    <div className={styles.spaces}>
      {spaces.map(space => (
        <div className={styles.space} key={space.id}>
          <div className={styles.shead}>
            <div className={styles.stitle}>{space.name}</div>
            <CoverageRing pct={space.coverage} />
          </div>
          <div className={styles.styp}>
            <span>{SOURCE_GLYPH.video} {space.counts.video}</span>
            <span>{SOURCE_GLYPH.article} {space.counts.article}</span>
            <span>{SOURCE_GLYPH.pdf} {space.counts.pdf}</span>
            <span>{SOURCE_GLYPH.chat} {space.counts.chat}</span>
            <span>{SOURCE_GLYPH.note} {space.counts.note}</span>
          </div>
          <div className={styles.sfoot}>
            <span className={styles.knownlbl}>{space.coverage}% KNOWN</span>
            <span>{space.lastActive}</span>
          </div>
        </div>
      ))}

      <NewSpaceTile />
    </div>
  )
}
