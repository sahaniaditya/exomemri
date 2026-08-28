import styles from './dashboard.module.css'
import type { PlanItem } from '@/lib/plan'

function sharedRationale(items: PlanItem[]): string | null {
  const first = items[0]?.rationale
  if (!first) return null
  return items.every(item => item.rationale === first) ? first : null
}

export default function PlanCard({ items }: { items: PlanItem[] }) {
  if (items.length === 0) {
    return (
      <div className={styles.rcard}>
        <p className={styles.summarytext}>Nothing to work on right now — you&apos;re caught up.</p>
      </div>
    )
  }

  const commonRationale = sharedRationale(items)
  const eyebrow = commonRationale ? 'Not yet covered' : 'Suggested next'

  return (
    <div className={styles.rcard}>
      <div className={styles.planhead}>
        <div className={styles.planeyebrow}>{eyebrow}</div>
        <h3 className={styles.planheading}>Topics missing from your captures</h3>
      </div>
      <ul className={styles.planlist}>
        {items.map((item, i) => (
          <li key={`${item.kind}-${item.title}-${i}`} className={styles.planitem}>
            <span className={styles.planmark} aria-hidden="true" />
            <div className={styles.planbody}>
              <div className={styles.plantitle}>{item.title}</div>
              {!commonRationale && (
                <div className={styles.planrationale}>{item.rationale}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
