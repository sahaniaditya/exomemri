import styles from './dashboard.module.css'
import type { PlanItem } from '@/lib/plan'

const KIND_LABEL: Record<PlanItem['kind'], string> = {
  uncovered_topic: 'Gap',
}

export default function PlanCard({ items }: { items: PlanItem[] }) {
  if (items.length === 0) {
    return (
      <div className={styles.rcard}>
        <p className={styles.summarytext}>Nothing to work on right now — you&apos;re caught up.</p>
      </div>
    )
  }

  return (
    <div className={styles.rcard}>
      <ol className={styles.planlist}>
        {items.map((item, i) => (
          <li key={`${item.kind}-${item.title}-${i}`} className={styles.planitem}>
            <span className={`${styles.plankind} ${styles[`plankind_${item.kind}`]}`}>
              {KIND_LABEL[item.kind]}
            </span>
            <div className={styles.planbody}>
              <div className={styles.plantitle}>{item.title}</div>
              <div className={styles.planrationale}>{item.rationale}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
