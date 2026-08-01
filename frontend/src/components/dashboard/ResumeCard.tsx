import { SOURCE_GLYPH, type ResumeItem } from '@/lib/dashboard-data'
import styles from './dashboard.module.css'

export default function ResumeCard({ item }: { item: ResumeItem | null }) {
  if (!item) {
    return (
      <div className={styles.empty}>
        <div className={styles.et}>Nothing in progress</div>
        <p>Capture a video, PDF or article and Atlas will pick up where you stop.</p>
      </div>
    )
  }

  return (
    <div className={styles.resume}>
      <div>
        <div className={styles.rlabel}>Resume · {item.spaceName}</div>
        <h3>{item.title}</h3>
        <div className={styles.meta}>
          <span className={styles.pill}>
            {SOURCE_GLYPH[item.kind]} {item.duration}
          </span>
          <span>
            Stopped at <strong>{item.stoppedAt}</strong>
          </span>
          <span>·</span>
          <span>Next: {item.unreadInSpace} unread sources in this space</span>
        </div>
      </div>
      <button type="button" className={styles.contbtn}>
        Continue&nbsp; →
      </button>
      <div
        className={styles.rprog}
        style={{ width: `${item.progress}%` }}
        title={`${item.progress}% through`}
      />
    </div>
  )
}
