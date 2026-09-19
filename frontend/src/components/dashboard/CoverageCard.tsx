'use client'

import { useState } from 'react'
import styles from './dashboard.module.css'
import type { CoverageResponse } from '@/lib/coverage'
import CoverageRing from './CoverageRing'

export default function CoverageCard({
  coverage: initial,
  spaceId,
  spaceName,
}: {
  coverage: CoverageResponse
  spaceId: string
  spaceName: string
}) {
  const [coverage, setCoverage] = useState(initial)
  const covered = coverage.topics.filter(t => t.covered)
  const gaps = coverage.topics.filter(t => !t.covered)
  const empty = covered.length === 0 && gaps.length === 0

  return (
    <div className={styles.rcard}>
      <div className={styles.covhead}>
        <div className={styles.covlabel}>Inferred syllabus</div>
        <CoverageRing
          spaceId={spaceId}
          spaceName={spaceName}
          initialCoverage={coverage.coverage_pct}
          onUpdated={setCoverage}
        />
      </div>

      {empty ? (
        <p className={styles.covempty}>
          {coverage.coverage_pct == null
            ? 'Check coverage to infer a syllabus from the concepts in this space.'
            : 'No syllabus topics came back. Try again after more sources are mapped.'}
        </p>
      ) : null}

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
