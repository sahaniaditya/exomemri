'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { regenerateSpaceCoverage } from '@/lib/coverage-client'
import type { CoverageResponse } from '@/lib/coverage'
import { showToast } from '@/lib/toast'
import styles from './dashboard.module.css'

const RADIUS = 22
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const UNMAPPED_MESSAGE =
  "Nothing to assess yet — sources in this space aren't mapped to concepts."

interface CoverageRingProps {
  /** Display-only percentage (public profile). */
  pct?: number
  /** When set, Check / refresh POSTs a regenerate. */
  spaceId?: string
  spaceName?: string
  initialCoverage?: number | null
  onUpdated?: (coverage: CoverageResponse) => void
}

export default function CoverageRing({
  pct,
  spaceId,
  spaceName,
  initialCoverage = null,
  onUpdated,
}: CoverageRingProps) {
  const router = useRouter()
  const [coverage, setCoverage] = useState<number | null>(pct ?? initialCoverage)
  const [loading, setLoading] = useState(false)

  const interactive = Boolean(spaceId)
  const checkLabel = spaceName ? `Check coverage for ${spaceName}` : 'Check coverage'
  const refreshLabel = spaceName
    ? `Recalculate coverage for ${spaceName}`
    : 'Recalculate coverage'

  async function handleRegenerate(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!spaceId || loading) return

    setLoading(true)
    try {
      const result = await regenerateSpaceCoverage(spaceId)
      if (!result.ok) {
        showToast(result.message)
        return
      }
      if (result.coverage.coverage_pct == null) {
        onUpdated?.(result.coverage)
        showToast(UNMAPPED_MESSAGE, 'info')
        return
      }
      setCoverage(result.coverage.coverage_pct)
      onUpdated?.(result.coverage)
      router.refresh()
    } catch {
      showToast('Could not reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function stopCardNav(e: React.SyntheticEvent) {
    e.stopPropagation()
  }

  if (!interactive && coverage === null) {
    return null
  }

  const control = (() => {
    if (interactive && coverage === null) {
      return (
        <button
          type="button"
          onClick={handleRegenerate}
          className={styles.checkCoverageBtn}
          disabled={loading}
          aria-busy={loading}
          aria-label={checkLabel}
        >
          {loading ? 'Calculating...' : 'Check Coverage'}
        </button>
      )
    }

    return (
      <div className={styles.ringGroup} aria-busy={loading}>
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
        {interactive ? (
          <button
            type="button"
            onClick={handleRegenerate}
            className={styles.recheckBtn}
            disabled={loading}
            aria-busy={loading}
            aria-label={refreshLabel}
            title="Recalculate coverage (uses 1 credit)"
          >
            {loading ? '…' : '↻'}
          </button>
        ) : null}
      </div>
    )
  })()

  if (!interactive) return control

  return (
    <div className={styles.spaceCoverage} onClick={stopCardNav} onMouseDown={stopCardNav}>
      {control}
    </div>
  )
}
