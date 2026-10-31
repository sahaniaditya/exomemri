import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { SNAPSHOT_IDLE_MS, SNAPSHOT_THROTTLE_MS } from '@/lib/notes/snapshotScheduler'
import { useIdleSnapshot } from './useIdleSnapshot'

const START = new Date('2026-11-01T10:00:00Z').getTime()

function mockFetch(ok = true) {
  const fn = vi.fn().mockResolvedValue(
    ok
      ? new Response(JSON.stringify({ id: 'v1' }), { status: 200 })
      : new Response('{}', { status: 500 })
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setVisibility('visible')
})

function mount(props: Partial<Parameters<typeof useIdleSnapshot>[0]> = {}) {
  return renderHook(
    (p: Parameters<typeof useIdleSnapshot>[0]) => useIdleSnapshot(p),
    {
      initialProps: {
        spaceId: 's1',
        noteId: 'n1',
        dirtySinceSnapshot: true,
        lastSavedAt: START,
        ...props,
      },
    }
  )
}

describe('useIdleSnapshot', () => {
  it('snapshots once after 60s of idle', async () => {
    const fetchMock = mockFetch()
    const onSnapshotted = vi.fn()
    mount({ onSnapshotted })
    await vi.advanceTimersByTimeAsync(SNAPSHOT_IDLE_MS - 1)
    expect(fetchMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/spaces/s1/notes/n1/versions')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ reason: 'idle' })
    expect(onSnapshotted).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the note is unchanged', async () => {
    const fetchMock = mockFetch()
    mount({ dirtySinceSnapshot: false })
    await vi.advanceTimersByTimeAsync(SNAPSHOT_THROTTLE_MS * 2)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a newer save restarts the idle wait', async () => {
    const fetchMock = mockFetch()
    const hook = mount()
    await vi.advanceTimersByTimeAsync(40_000)
    hook.rerender({
      spaceId: 's1',
      noteId: 'n1',
      dirtySinceSnapshot: true,
      lastSavedAt: Date.now(),
    })
    await vi.advanceTimersByTimeAsync(40_000)
    expect(fetchMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throttles to one snapshot per 5 minutes', async () => {
    const fetchMock = mockFetch()
    const hook = mount()
    await vi.advanceTimersByTimeAsync(SNAPSHOT_IDLE_MS)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // New edit saved right after the snapshot.
    hook.rerender({
      spaceId: 's1',
      noteId: 'n1',
      dirtySinceSnapshot: true,
      lastSavedAt: Date.now(),
    })
    await vi.advanceTimersByTimeAsync(SNAPSHOT_IDLE_MS + 5000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(SNAPSHOT_THROTTLE_MS - SNAPSHOT_IDLE_MS)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('flushes when the tab is hidden, without waiting for idle', async () => {
    const fetchMock = mockFetch()
    mount({ lastSavedAt: START - 1000 })
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchMock).not.toHaveBeenCalled()
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('hidden flush is skipped when unchanged or throttled', async () => {
    const fetchMock = mockFetch()
    mount({ dirtySinceSnapshot: false })
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('swallows failures silently and does not call onSnapshotted', async () => {
    const fetchMock = mockFetch(false)
    const onSnapshotted = vi.fn()
    mount({ onSnapshotted })
    await vi.advanceTimersByTimeAsync(SNAPSHOT_IDLE_MS)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onSnapshotted).not.toHaveBeenCalled()
  })

  it('swallows network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    mount()
    await expect(vi.advanceTimersByTimeAsync(SNAPSHOT_IDLE_MS)).resolves.not.toThrow()
  })

  it('stops the timer on unmount', async () => {
    const fetchMock = mockFetch()
    const hook = mount()
    hook.unmount()
    await vi.advanceTimersByTimeAsync(SNAPSHOT_THROTTLE_MS)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
