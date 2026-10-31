'use client'

/**
 * Takes a version snapshot after a note has been idle, throttled, and only if it
 * changed. Failures are silent: history is a convenience and must never block editing.
 */
import { useCallback, useEffect, useRef } from 'react'

import { snapshotDelayMs } from '@/lib/notes/snapshotScheduler'
import { createSnapshot } from '@/lib/notes/versions'

export interface UseIdleSnapshotArgs {
  spaceId: string
  noteId: string
  /** True when the note changed since the last snapshot. */
  dirtySinceSnapshot: boolean
  /** Epoch ms of the last successful autosave. */
  lastSavedAt: number | null
  /** Called after a snapshot request succeeds so the caller can clear its dirty flag. */
  onSnapshotted?: () => void
}

export function useIdleSnapshot({
  spaceId,
  noteId,
  dirtySinceSnapshot,
  lastSavedAt,
  onSnapshotted,
}: UseIdleSnapshotArgs): void {
  const lastAttemptAt = useRef<number | null>(null)
  const inFlight = useRef(false)
  const latest = useRef({ dirtySinceSnapshot, lastSavedAt, onSnapshotted })
  useEffect(() => {
    latest.current = { dirtySinceSnapshot, lastSavedAt, onSnapshotted }
  })

  const attempt = useCallback(
    async (tabHidden: boolean) => {
      const { dirtySinceSnapshot: dirty, lastSavedAt: saved } = latest.current
      const delay = snapshotDelayMs({
        now: Date.now(),
        lastAttemptAt: lastAttemptAt.current,
        lastSavedAt: saved,
        dirty,
        tabHidden,
      })
      if (delay !== 0 || inFlight.current) return
      inFlight.current = true
      lastAttemptAt.current = Date.now()
      try {
        await createSnapshot(spaceId, noteId, 'idle')
        latest.current.onSnapshotted?.()
      } catch {
        // Silent by design; the next trigger retries after the throttle window.
      } finally {
        inFlight.current = false
      }
    },
    [spaceId, noteId]
  )

  // A different note starts a fresh throttle window.
  useEffect(() => {
    lastAttemptAt.current = null
  }, [spaceId, noteId])

  useEffect(() => {
    const delay = snapshotDelayMs({
      now: Date.now(),
      lastAttemptAt: lastAttemptAt.current,
      lastSavedAt,
      dirty: dirtySinceSnapshot,
    })
    if (delay === null) return
    const timer = setTimeout(() => void attempt(false), delay)
    return () => clearTimeout(timer)
  }, [dirtySinceSnapshot, lastSavedAt, attempt])

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden') void attempt(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [attempt])
}
