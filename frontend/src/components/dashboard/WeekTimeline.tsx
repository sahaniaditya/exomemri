import type { ActivityDay } from '@/lib/dashboard-data'
import styles from './dashboard.module.css'

interface WeekTimelineProps {
  days: ActivityDay[]
  deltaLabel: string
}

export default function WeekTimeline({ days, deltaLabel }: WeekTimelineProps) {
  return (
    <div className={styles.tlwrap}>
      <div className={styles.tlbar}>
        {days.map(day => (
          <div className={styles.tlday} key={day.label}>
            <div
              className={`${styles.tlcol} ${day.isToday ? styles.today : ''}`}
              style={{ height: `${day.intensity}%` }}
            />
            <span className={styles.tld}>{day.label}</span>
          </div>
        ))}
      </div>
      <div className={styles.tllegend}>
        <span>Sources captured &amp; concepts learned per day</span>
        <span className={styles.tldelta}>{deltaLabel}</span>
      </div>
    </div>
  )
}
