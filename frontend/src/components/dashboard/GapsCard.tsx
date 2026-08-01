import type { StudyGap } from '@/lib/dashboard-data'
import styles from './dashboard.module.css'

export default function GapsCard({ gaps }: { gaps: StudyGap[] }) {
  return (
    <div className={styles.rcard}>
      <h4>What to study next</h4>
      <p className={styles.cap}>
        Gaps Atlas found across what you’ve saved but haven’t learned yet.
      </p>
      <div className={styles.nextlist}>
        {gaps.map(gap => (
          <div className={styles.nextitem} key={gap.id}>
            <span className={styles.gap} />
            <div>
              <div className={styles.nt}>{gap.concept}</div>
              <div className={styles.ns}>
                {gap.spaceName.toUpperCase()} · {gap.reason.toUpperCase()}
              </div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className={`${styles.railbtn} ${styles.ghost}`}>
        See full gap map
      </button>
    </div>
  )
}
