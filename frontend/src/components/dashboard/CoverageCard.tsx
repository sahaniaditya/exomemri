import styles from './dashboard.module.css'
import type { CoverageResponse } from '@/lib/coverage'
import CoverageRing from './CoverageRing'

export default function CoverageCard({ coverage }: { coverage: CoverageResponse }) {
  if (coverage.coverage_pct === null) {
    return (
      <div className={styles.rcard}>
        <p className={styles.covempty}>
          Not assessed yet — capture a few sources so a syllabus can be inferred.
        </p>
      </div>
    )
  }

  const covered = coverage.topics.filter(t => t.covered)
  const gaps = coverage.topics.filter(t => !t.covered)

  return (
    <div className={styles.rcard}>
      <div className={styles.covhead}>
        <div className={styles.covlabel}>Inferred syllabus</div>
        <CoverageRing pct={coverage.coverage_pct} />
      </div>

      {covered.length > 0 && (
        <div className={styles.covsection}>
          <div className={styles.covsectiontitle}>Covered</div>
          <div className={styles.covchips}>
            {covered.map(topic => (
              <span key={topic.label} className={styles.covchip}>
                {topic.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {gaps.length > 0 && (
        <div className={styles.covsection}>
          <div className={styles.covsectiontitle}>Gaps</div>
          <div className={styles.covchips}>
            {gaps.map(topic => (
              <span key={topic.label} className={`${styles.covchip} ${styles.covchipgap}`}>
                {topic.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
