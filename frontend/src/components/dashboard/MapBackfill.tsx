'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './dashboard.module.css'

interface MapBackfillProps {
  spaceId: string
  /** Sources with no concepts extracted yet, from the server render. */
  pending: number
}

interface RebuildResponse {
  processed: number
  failed: number
  pending: number
}

/**
 * Maps sources captured before the knowledge map existed.
 *
 * New captures are mapped automatically by the capture pipeline, so this only
 * appears for a backlog. The backend bounds each call to a batch that fits
 * inside its request timeout, which is why this loops rather than firing once.
 */
export default function MapBackfill({ spaceId, pending }: MapBackfillProps) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Progress observed locally while the loop runs, tagged with the server value
  // it started from. Derived during render rather than mirrored into state via
  // an effect, so a fresh `pending` from router.refresh() automatically wins and
  // there is no cascading re-render.
  const [progress, setProgress] = useState<{ from: number; value: number } | null>(null)
  const remaining = progress?.from === pending ? progress.value : pending
  // Set on unmount, so the loop stops touching state after it goes away.
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    return () => {
      cancelled.current = true
    }
  }, [])

  const run = useCallback(async () => {
    setRunning(true)
    setError(null)
    const total = remaining
    const from = pending

    try {
      // Bounded: `total` sources can need at most `total` batches, so a backend
      // that stops making progress ends the loop instead of spinning forever.
      for (let attempt = 0; attempt < total; attempt += 1) {
        const res = await fetch(`/api/spaces/${spaceId}/graph/rebuild`, { method: 'POST' })
        if (!res.ok) {
          setError(
            res.status === 401
              ? 'Your session expired. Reload the page and sign in again.'
              : 'Mapping failed. Try again in a moment.'
          )
          return
        }
        const data = (await res.json()) as RebuildResponse
        if (cancelled.current) return

        const advanced = data.processed + data.failed
        setProgress({ from, value: data.pending })

        if (data.pending === 0) break
        if (advanced === 0) {
          setError('Mapping stalled with sources left unprocessed. Try again in a moment.')
          return
        }
      }
      // Pull the freshly mapped graph through the server component.
      router.refresh()
    } catch (caught) {
      console.error('Knowledge map backfill failed:', caught)
      if (!cancelled.current) setError('Mapping failed. Check your connection and try again.')
    } finally {
      if (!cancelled.current) setRunning(false)
    }
  }, [remaining, pending, spaceId, router])

  if (remaining === 0 && !error) return null

  return (
    <div className={styles.backfill} role="status" aria-live="polite">
      <div className={styles.backfilltext}>
        {running ? (
          <>
            <span className={styles.backfilllabel}>
              Mapping {remaining} {remaining === 1 ? 'source' : 'sources'}
              <span className={styles.typingdot} />
              <span className={styles.typingdot} />
              <span className={styles.typingdot} />
            </span>
            <p>Reading each capture and pulling out what it covers. This can take a minute.</p>
          </>
        ) : (
          <>
            <span className={styles.backfilllabel}>
              {remaining} {remaining === 1 ? 'source is' : 'sources are'} not on the map yet
            </span>
            <p>
              These were captured before the map existed. Mapping them reads each one once and
              caches the result.
            </p>
          </>
        )}
        {error ? <p className={styles.backfillerror}>{error}</p> : null}
      </div>

      {!running ? (
        <button type="button" className={styles.maptoggle} onClick={run}>
          {error ? 'Retry' : 'Map them'}
        </button>
      ) : null}
    </div>
  )
}
