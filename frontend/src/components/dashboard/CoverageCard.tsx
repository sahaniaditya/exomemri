'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function assess() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/spaces/${spaceId}/coverage`, { method: 'POST' })
      if (res.status === 402) {
        setError("You're out of credits. Coverage unlocks when your monthly allowance resets.")
        return
      }
      if (res.status === 429) {
        setError('Coverage was just generated. Try again in a bit.')
        return
      }
      if (!res.ok) {
        setError('Could not assess coverage. Try again in a moment.')
        return
      }
      router.refresh()
    } catch (caught) {
      console.error('Coverage assess failed:', caught)
      setError('Could not assess coverage. Check your connection.')
    } finally {
      setBusy(false)
    }
  }

  if (coverage.coverage_pct === null) {
    return (
      <div className={styles.rcard}>
        <p className={styles.covempty}>
          Not assessed yet — capture a few sources, then spend one credit to infer a syllabus.
        </p>
        <button
          type="button"
          className={styles.maptoggle}
          onClick={assess}
          disabled={busy}
        >
          {busy ? 'Assessing…' : 'Assess coverage'}
        </button>
        {error ? <p className={styles.backfillerror}>{error}</p> : null}
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
