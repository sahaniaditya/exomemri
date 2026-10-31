import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  SESSION_EXPIRED_MESSAGE,
  useAutosave,
  type AutosaveField,
  type AutosaveOptions,
} from './useAutosave'

const ENDPOINT = '/api/spaces/s1/notes/n1'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function page(updatedAt: string) {
  return { id: 'n1', title: 'T', content: {}, sort_order: 0, updated_at: updatedAt }
}

let fetchMock: ReturnType<typeof vi.fn>

function body(call: number): Record<string, unknown> {
  return JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string)
}

function setup(overrides: Partial<AutosaveOptions> = {}) {
  const values: Record<AutosaveField, unknown> = { title: 'Title', content: { type: 'doc' } }
  const hook = renderHook(() =>
    useAutosave({
      endpoint: ENDPOINT,
      initialUpdatedAt: 'T0',
      read: field => values[field],
      ...overrides,
    })
  )
  return { ...hook, values }
}

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useAutosave', () => {
  it('starts idle', () => {
    const { result } = setup()
    expect(result.current.status).toBe('idle')
    expect(result.current.lastSavedAt).toBe('T0')
  })

  it('debounces 1500 ms after the last edit, then saves', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, page('T1')))
    const { result } = setup()

    act(() => result.current.markDirty('content'))
    expect(result.current.status).toBe('dirty')
    await act(() => vi.advanceTimersByTimeAsync(1499))
    expect(fetchMock).not.toHaveBeenCalled()

    // Another edit restarts the debounce.
    act(() => result.current.markDirty('content'))
    await act(() => vi.advanceTimersByTimeAsync(1499))
    expect(fetchMock).not.toHaveBeenCalled()

    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(ENDPOINT)
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('PUT')
    expect(body(0)).toEqual({ content: { type: 'doc' }, expected_updated_at: 'T0' })
    expect(result.current.status).toBe('saved')
    expect(result.current.lastSavedAt).toBe('T1')
  })

  it('reports saving while the request is in flight', async () => {
    let resolve!: (res: Response) => void
    fetchMock.mockReturnValue(new Promise<Response>(r => (resolve = r)))
    const { result } = setup()
    act(() => result.current.markDirty('content'))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(result.current.status).toBe('saving')
    await act(async () => resolve(jsonResponse(200, page('T1'))))
    expect(result.current.status).toBe('saved')
  })

  it('saves at most 10 s after the first edit during continuous typing', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, page('T1')))
    const { result } = setup()
    // An edit every second keeps the 1.5 s debounce from ever firing.
    for (let second = 0; second < 9; second += 1) {
      act(() => result.current.markDirty('content'))
      await act(() => vi.advanceTimersByTimeAsync(1000))
    }
    expect(fetchMock).not.toHaveBeenCalled() // 9 s elapsed
    act(() => result.current.markDirty('content'))
    await act(() => vi.advanceTimersByTimeAsync(999))
    expect(fetchMock).not.toHaveBeenCalled() // 9.999 s
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(fetchMock).toHaveBeenCalledTimes(1) // 10 s
  })

  it('flush() saves immediately without waiting for the debounce', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, page('T1')))
    const { result } = setup()
    act(() => result.current.markDirty('title'))
    await act(async () => result.current.flush())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(body(0)).toEqual({ title: 'Title', expected_updated_at: 'T0' })
    // The debounce timer was cleared: no second request later.
    await act(() => vi.advanceTimersByTimeAsync(20_000))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('flush() with nothing dirty does not call the server', async () => {
    const { result } = setup()
    await act(async () => result.current.flush())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('flushes with keepalive on pagehide', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, page('T1')))
    const { result } = setup()
    act(() => result.current.markDirty('content'))
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0][1] as RequestInit).keepalive).toBe(true)
  })

  it('flushes with keepalive when the tab becomes hidden', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, page('T1')))
    const { result } = setup()
    act(() => result.current.markDirty('content'))
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    spy.mockRestore()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0][1] as RequestInit).keepalive).toBe(true)
  })

  it('does not flush when the tab becomes visible', async () => {
    const { result } = setup()
    act(() => result.current.markDirty('content'))
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('flushes pending edits on unmount with keepalive', () => {
    fetchMock.mockResolvedValue(jsonResponse(200, page('T1')))
    const { result, unmount } = setup()
    act(() => result.current.markDirty('content'))
    unmount()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0][1] as RequestInit).keepalive).toBe(true)
  })

  it('never has two saves in flight; edits during a save yield exactly one follow-up', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const resolvers: Array<(res: Response) => void> = []
    fetchMock.mockImplementation(() => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      return new Promise<Response>(resolve => {
        resolvers.push(res => {
          inFlight -= 1
          resolve(res)
        })
      })
    })
    const { result } = setup()

    act(() => result.current.markDirty('content'))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Several edits (and a debounce firing) while the first save is still in flight.
    act(() => result.current.markDirty('content'))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    act(() => result.current.markDirty('content'))
    act(() => result.current.markDirty('title'))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    act(() => result.current.flush())
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => resolvers[0](jsonResponse(200, page('T1'))))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(body(1)).toEqual({
      content: { type: 'doc' },
      title: 'Title',
      expected_updated_at: 'T1',
    })

    await act(async () => resolvers[1](jsonResponse(200, page('T2'))))
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(maxInFlight).toBe(1)
    expect(result.current.status).toBe('saved')
  })

  it('an edit during a save that is not flushed saves via its own debounce', async () => {
    const resolvers: Array<(res: Response) => void> = []
    fetchMock.mockImplementation(
      () => new Promise<Response>(resolve => resolvers.push(resolve))
    )
    const { result } = setup()
    act(() => result.current.markDirty('content'))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    act(() => result.current.markDirty('content'))
    await act(async () => resolvers[0](jsonResponse(200, page('T1'))))
    expect(result.current.status).toBe('dirty')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('chains expected_updated_at from each response', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, page('T1')))
      .mockResolvedValueOnce(jsonResponse(200, page('T2')))
      .mockResolvedValueOnce(jsonResponse(200, page('T3')))
    const { result } = setup()
    for (let i = 0; i < 3; i += 1) {
      act(() => result.current.markDirty('content'))
      await act(() => vi.advanceTimersByTimeAsync(1500))
    }
    expect(body(0).expected_updated_at).toBe('T0')
    expect(body(1).expected_updated_at).toBe('T1')
    expect(body(2).expected_updated_at).toBe('T2')
  })

  it('omits expected_updated_at when the note has no known timestamp', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, page('T1')))
    const { result } = setup({ initialUpdatedAt: null })
    act(() => result.current.markDirty('content'))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(body(0)).not.toHaveProperty('expected_updated_at')
  })

  it('skips fields whose value is undefined', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, page('T1')))
    const { result, values } = setup()
    values.title = undefined
    act(() => {
      result.current.markDirty('title')
      result.current.markDirty('content')
    })
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(body(0)).not.toHaveProperty('title')
    expect(body(0)).toHaveProperty('content')
  })

  it('reports saved pages through onSaved', async () => {
    const onSaved = vi.fn()
    fetchMock.mockResolvedValue(jsonResponse(200, page('T1')))
    const { result } = setup({ onSaved })
    act(() => result.current.markDirty('content'))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ updated_at: 'T1' }))
  })

  it('retries failures with exponential backoff capped at 30 s', async () => {
    fetchMock.mockRejectedValue(new TypeError('network'))
    const { result } = setup()
    act(() => result.current.markDirty('content'))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('error')

    const delays = [2000, 4000, 8000, 16_000, 30_000, 30_000]
    let calls = 1
    for (const delay of delays) {
      await act(() => vi.advanceTimersByTimeAsync(delay - 1))
      expect(fetchMock).toHaveBeenCalledTimes(calls)
      await act(() => vi.advanceTimersByTimeAsync(1))
      calls += 1
      expect(fetchMock).toHaveBeenCalledTimes(calls)
      expect(result.current.status).toBe('error')
    }
  })

  it('treats a 5xx like a failure and recovers on a later success', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, { error: { code: 'internal_error' } }))
      .mockResolvedValueOnce(jsonResponse(200, page('T1')))
    const { result } = setup()
    act(() => result.current.markDirty('content'))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBeTruthy()
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // The failed payload was resent unchanged (same expected timestamp).
    expect(body(1)).toEqual(body(0))
    expect(result.current.status).toBe('saved')
    expect(result.current.errorMessage).toBeNull()
  })

  it('retry() resends immediately and resets the backoff', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(jsonResponse(200, page('T1')))
    const { result } = setup()
    act(() => result.current.markDirty('content'))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(result.current.status).toBe('error')
    await act(async () => result.current.retry())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('saved')
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('a 409 moves to conflict, records the server timestamp and stops retrying', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        error: { code: 'note_conflict', message: 'x', detail: { updated_at: 'T9' } },
      })
    )
    const { result } = setup()
    act(() => result.current.markDirty('content'))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(result.current.status).toBe('conflict')
    expect(result.current.conflictUpdatedAt).toBe('T9')

    // Further edits and flushes do not hit the server while in conflict.
    act(() => result.current.markDirty('content'))
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    await act(async () => result.current.flush())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('conflict')
  })

  it('keepMine() resends without expected_updated_at, then chains from the response', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(409, {
          error: { code: 'note_conflict', message: 'x', detail: { updated_at: 'T9' } },
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, page('T10')))
      .mockResolvedValueOnce(jsonResponse(200, page('T11')))
    const { result } = setup()
    act(() => result.current.markDirty('content'))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(result.current.status).toBe('conflict')

    await act(async () => result.current.keepMine())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(body(1)).not.toHaveProperty('expected_updated_at')
    expect(body(1)).toHaveProperty('content')
    expect(result.current.status).toBe('saved')
    expect(result.current.conflictUpdatedAt).toBeNull()

    act(() => result.current.markDirty('content'))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(body(2).expected_updated_at).toBe('T10')
  })

  it('a 401 reports an expired session and never retries', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'Unauthorized' }))
    const { result } = setup()
    act(() => result.current.markDirty('content'))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe(SESSION_EXPIRED_MESSAGE)
    await act(() => vi.advanceTimersByTimeAsync(120_000))
    await act(async () => result.current.flush())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
