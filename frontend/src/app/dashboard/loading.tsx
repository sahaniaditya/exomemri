import { atlasFontVars } from '@/lib/fonts'
import styles from '@/components/dashboard/dashboard.module.css'

export default function DashboardLoading() {
  return (
    <div className={`${styles.loading} ${atlasFontVars}`}>Loading your learning memory…</div>
  )
}
