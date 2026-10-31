/**
 * Pure scheduling rules for idle version snapshots.
 *
 * A snapshot is taken only when the note changed since the last one, no more
 * than once per throttle window, and after the note has been idle (no saves)
 * for a while. A hidden tab flushes early, but still honours the throttle.
 */

export const SNAPSHOT_THROTTLE_MS = 5 * 60 * 1000
export const SNAPSHOT_IDLE_MS = 60 * 1000

export interface SnapshotState {
  now: number
  /** Epoch ms of the last snapshot attempt, or null if none yet this session. */
  lastAttemptAt: number | null
  /** Epoch ms of the last successful autosave, or null if nothing saved yet. */
  lastSavedAt: number | null
  /** True when the note changed since the last snapshot. */
  dirty: boolean
  /** True when called because the tab became hidden. */
  tabHidden?: boolean
}

/** Milliseconds until a snapshot is allowed; null when none is needed. */
export function snapshotDelayMs(state: SnapshotState): number | null {
  if (!state.dirty || state.lastSavedAt === null) return null
  const throttleLeft =
    state.lastAttemptAt === null
      ? 0
      : state.lastAttemptAt + SNAPSHOT_THROTTLE_MS - state.now
  const idleLeft = state.tabHidden ? 0 : state.lastSavedAt + SNAPSHOT_IDLE_MS - state.now
  return Math.max(0, throttleLeft, idleLeft)
}

export function shouldSnapshot(state: SnapshotState): boolean {
  return snapshotDelayMs(state) === 0
}
