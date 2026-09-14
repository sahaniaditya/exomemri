'use client'

import styles from './dashboard.module.css'
import type { CoverageResponse } from '@/lib/coverage'
import CoverageRing from './CoverageRing'

export default function CoverageCard({
  coverage,
  spaceId,
}: {
  coverage: CoverageResponse
  spaceId: string
}) {
  const covered = coverage.topics.filter(t => t.covered)
  const gaps = coverage.topics.filter(t => !t.covered)

  return (
    <div className={styles.rcard}>
      <div className={styles.covhead}>
        <div className={styles.covlabel}>Inferred syllabus</div>
        {/* Pass spaceId and coverage_pct into your updated CoverageRing */}
        <CoverageRing
          spaceId={spaceId}
          initialCoverage={coverage.coverage_pct}
        />
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