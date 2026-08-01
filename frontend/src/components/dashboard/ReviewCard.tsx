import type { ReviewQueue } from '@/lib/dashboard-data'
import styles from './dashboard.module.css'
import Plate from './Plate'

export default function ReviewCard({ review }: { review: ReviewQueue }) {
  return (
    <div className={`${styles.rcard} ${styles.review}`}>
      <Plate num="04" title="Due for review" />
      <div className={styles.big}>
        <span className={styles.n}>{review.total}</span>
        <span className={styles.u}>cards ready</span>
      </div>
      <div className={styles.chips}>
        {review.breakdown.map(item => (
          <span className={styles.chip} key={item.spaceName}>
            {item.spaceName} · {item.count}
          </span>
        ))}
      </div>
      <button type="button" className={styles.railbtn}>
        Start review session
      </button>
      <p className={styles.note}>Weighted toward your weakest concepts</p>
    </div>
  )
}
