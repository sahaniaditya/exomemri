import { describe, expect, it } from 'vitest'

import {
  SNAPSHOT_IDLE_MS,
  SNAPSHOT_THROTTLE_MS,
  shouldSnapshot,
  snapshotDelayMs,
  type SnapshotState,
} from './snapshotScheduler'

const NOW = 10_000_000

function state(overrides: Partial<SnapshotState>): SnapshotState {
  return { now: NOW, lastAttemptAt: null, lastSavedAt: NOW - 61_000, dirty: true, ...overrides }
}

describe('shouldSnapshot', () => {
  const cases: Array<[string, Partial<SnapshotState>, boolean]> = [
    ['dirty, idle 61s, never snapshotted', {}, true],
    ['idle exactly 60s', { lastSavedAt: NOW - SNAPSHOT_IDLE_MS }, true],
    ['idle only 59s', { lastSavedAt: NOW - 59_000 }, false],
    ['unchanged note never snapshots', { dirty: false }, false],
    ['nothing saved yet', { lastSavedAt: null }, false],
    ['last snapshot 4m59s ago (throttled)', { lastAttemptAt: NOW - (SNAPSHOT_THROTTLE_MS - 1000) }, false],
    ['last snapshot exactly 5m ago', { lastAttemptAt: NOW - SNAPSHOT_THROTTLE_MS }, true],
    ['last snapshot 10m ago', { lastAttemptAt: NOW - 600_000 }, true],
    ['hidden tab skips the idle wait', { tabHidden: true, lastSavedAt: NOW - 1000 }, true],
    [
      'hidden tab still honours the throttle',
      { tabHidden: true, lastSavedAt: NOW - 1000, lastAttemptAt: NOW - 60_000 },
      false,
    ],
    ['hidden tab but unchanged', { tabHidden: true, dirty: false }, false],
  ]
  it.each(cases)('%s', (_name, overrides, expected) => {
    expect(shouldSnapshot(state(overrides))).toBe(expected)
  })
})

describe('snapshotDelayMs', () => {
  it('returns null when no snapshot is needed', () => {
    expect(snapshotDelayMs(state({ dirty: false }))).toBeNull()
    expect(snapshotDelayMs(state({ lastSavedAt: null }))).toBeNull()
  })

  it('waits for whichever of idle and throttle ends last', () => {
    expect(snapshotDelayMs(state({ lastSavedAt: NOW - 10_000 }))).toBe(50_000)
    expect(
      snapshotDelayMs(state({ lastAttemptAt: NOW - 100_000, lastSavedAt: NOW - 10_000 }))
    ).toBe(SNAPSHOT_THROTTLE_MS - 100_000)
  })
})
