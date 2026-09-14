// @/components/dashboard/OnDemandCoverage.tsx
'use client'

import { useState } from 'react'
import { calculateCoverageAction } from './Coverage'
import styles from './dashboard.module.css'

const RADIUS = 22
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface OnDemandCoverageProps {
  spaceId: string
  initialCoverage: number | null
}

export default function OnDemandCoverage({
  spaceId,
  initialCoverage,
}: OnDemandCoverageProps) {
  const [coverage, setCoverage] = useState<number | null>(initialCoverage)
  const [loading, setLoading] = useState(false)

  async function handleCheckCoverage(e: React.MouseEvent) {
    // Prevent navigating if clicked inside a Next.js <Link>
    e.preventDefault()
    e.stopPropagation()

    if (loading) return
    setLoading(true)

    try {
      const updatedPct = await calculateCoverageAction(spaceId)
      setCoverage(updatedPct)
    } catch (error) {
      console.error('Failed to calculate coverage:', error)
    } finally {
      setLoading(false)
    }
  }

  // State 1: User hasn't checked coverage yet (or initial is null)
  if (coverage === null && !loading) {
    return (
      <button
        type="button"
        onClick={handleCheckCoverage}
        className={styles.checkCoverageBtn}
      >
        Check Coverage
      </button>
    )
  }

  // State 2: Spinner / Loading
  if (loading) {
    return <div className={styles.coverageSpinner}>Calculating...</div>
  }

  // State 3: Display Coverage Dial with an optional re-check button on hover/click
  return (
    <div className={styles.ringGroup}>
      <div className={styles.ring}>
        <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
          <circle className={styles.rt} cx="26" cy="26" r={RADIUS} />
          <circle
            className={styles.rv}
            cx="26"
            cy="26"
            r={RADIUS}
            style={{
              strokeDasharray: CIRCUMFERENCE,
              strokeDashoffset: CIRCUMFERENCE * (1 - (coverage ?? 0) / 100),
            }}
          />
        </svg>
        <div className={styles.pct}>{coverage}%</div>
      </div>
      <button
        type="button"
        onClick={handleCheckCoverage}
        className={styles.recheckBtn}
        title="Recalculate coverage"
      >
        ↻
      </button>
    </div>
  )
}