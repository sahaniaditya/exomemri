import type { StatCard } from '@/lib/dashboard-data'
import styles from './dashboard.module.css'

export default function StatsRow({ stats }: { stats: StatCard[] }) {
  return (
    <div className={styles.stats}>
      {stats.map(stat => (
        <div className={styles.stat} key={stat.label}>
          <div className={styles.n}>
            {stat.value}
            {stat.unit && <span className={styles.u}>{stat.unit}</span>}
          </div>
          <div className={styles.k}>{stat.label}</div>
          <div className={`${styles.d} ${stat.deltaPositive ? styles.up : ''}`}>{stat.delta}</div>
        </div>
      ))}
    </div>
  )
}
