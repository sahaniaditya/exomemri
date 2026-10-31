import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import NoteCanvas from '../NoteCanvas'
import { FULL_WIDTH_STORAGE_KEY } from '@/lib/notes/fullWidthPref'
import type { NotePage } from '@/lib/notes'
import { installLayoutStubs, jsonResponse } from './jsdomStubs'

// Panels and tools mounted by the canvas have their own tests; stub them so these tests stay on autosave.
vi.mock('../AiAssistMenu', () => ({ default: () => null }))
vi.mock('../BacklinksPanel', () => ({ default: () => null }))
vi.mock('../LinkPicker', () => ({ default: () => null }))
vi.mock('../NoteBlockTools', () => ({ default: () => null }))
vi.mock('../NoteHeaderMeta', () => ({ default: () => null }))
vi.mock('../OutlinePanel', () => ({ default: () => null }))
vi.mock('../VersionHistory', () => ({ default: () => null }))
vi.mock('../hooks/useIdleSnapshot', () => ({ useIdleSnapshot: () => undefined }))

const NOTE: NotePage = {
  id: 'n1',
  title: 'Original title',
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
  },
  sort_order: 0,
  updated_at: '2026-10-31T10:00:00+00:00',
}

let fetchMock: ReturnType<typeof vi.fn>

function putBodies(): Array<Record<string, unknown>> {
  return fetchMock.mock.calls
    .filter(call => (call[1] as RequestInit | undefined)?.method === 'PUT')
    .map(call => JSON.parse((call[1] as RequestInit).body as string))
}

async function renderReady(onReload?: () => void) {
  const view = render(
    <NoteCanvas spaceId="s1" spaceName="System Design" note={NOTE} onReload={onReload} />
  )
  // The document is hydrated asynchronously; wait for it before faking timers.
  await screen.findByText('Hello world')
  return view
}

beforeEach(() => {
  installLayoutStubs()
  window.localStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('NoteCanvas', () => {
  it('shows the title, breadcrumb, back link and the loaded content', async () => {
    await renderReady()
    expect(screen.getByLabelText('Page title')).toHaveValue('Original title')
    expect(screen.getByRole('link', { name: /back to space/i })).toHaveAttribute(
      'href',
      '/dashboard/spaces/s1#space-notes'
    )
    expect(screen.getByRole('link', { name: 'System Design' })).toHaveAttribute(
      'href',
      '/dashboard/spaces/s1'
    )
    expect(screen.getByTestId('save-status')).toHaveTextContent('Saved')
  })

  it('saves an edited title after the debounce, showing Saving then Saved', async () => {
    await renderReady()
    let resolve!: (res: Response) => void
    fetchMock.mockReturnValue(new Promise<Response>(r => (resolve = r)))
    vi.useFakeTimers()

    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: '  New name  ' } })
    expect(screen.getByTestId('save-status')).toHaveTextContent('Unsaved changes')
    await act(() => vi.advanceTimersByTimeAsync(1499))
    expect(putBodies()).toHaveLength(0)

    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(putBodies()).toEqual([
      { title: 'New name', expected_updated_at: '2026-10-31T10:00:00+00:00' },
    ])
    expect(fetchMock.mock.calls[0][0]).toBe('/api/spaces/s1/notes/n1')
    expect(screen.getByTestId('save-status')).toHaveTextContent('Saving…')

    await act(async () =>
      resolve(jsonResponse(200, { ...NOTE, title: 'New name', updated_at: '2026-10-31T10:01:00+00:00' }))
    )
    expect(screen.getByTestId('save-status')).toHaveTextContent('Saved')
  })

  it('reverts an emptied title on blur and never sends it', async () => {
    await renderReady()
    vi.useFakeTimers()
    const input = screen.getByLabelText('Page title')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.blur(input)
    expect(input).toHaveValue('Original title')
    await act(() => vi.advanceTimersByTimeAsync(20_000))
    expect(putBodies()).toHaveLength(0)
  })

  it('does not send a title that becomes empty before the debounce fires', async () => {
    await renderReady()
    vi.useFakeTimers()
    const input = screen.getByLabelText('Page title')
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.change(input, { target: { value: '' } })
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(putBodies()).toHaveLength(0)
  })

  it('flushes a valid title immediately on blur', async () => {
    await renderReady()
    fetchMock.mockResolvedValue(jsonResponse(200, { ...NOTE, title: 'Blur me' }))
    const input = screen.getByLabelText('Page title')
    fireEvent.change(input, { target: { value: 'Blur me' } })
    await act(async () => {
      fireEvent.blur(input)
    })
    expect(putBodies()).toEqual([
      { title: 'Blur me', expected_updated_at: '2026-10-31T10:00:00+00:00' },
    ])
  })

  it('shows an error with a Retry button when saving fails, then recovers', async () => {
    await renderReady()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, { error: { code: 'internal_error' } }))
      .mockResolvedValueOnce(jsonResponse(200, { ...NOTE, title: 'Oops' }))
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Oops' } })
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(screen.getByTestId('save-status')).toHaveTextContent(/couldn.t save/i)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    })
    expect(putBodies()).toHaveLength(2)
    expect(screen.getByTestId('save-status')).toHaveTextContent('Saved')
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('shows a session-expired message without a Retry button on 401', async () => {
    await renderReady()
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'Unauthorized' }))
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'x' } })
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(screen.getByTestId('save-status')).toHaveTextContent(/session has expired/i)
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(putBodies()).toHaveLength(1)
  })

  it('shows the conflict banner; Keep my version resends without expected_updated_at', async () => {
    await renderReady()
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(409, {
          error: {
            code: 'note_conflict',
            message: 'x',
            detail: { updated_at: '2026-10-31T10:05:00+00:00' },
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { ...NOTE, title: 'Mine', updated_at: 'T2' }))
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Mine' } })
    await act(() => vi.advanceTimersByTimeAsync(1500))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This page was changed in another tab or device.'
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Keep my version' }))
    })
    const bodies = putBodies()
    expect(bodies).toHaveLength(2)
    expect(bodies[1]).not.toHaveProperty('expected_updated_at')
    expect(bodies[1]).toHaveProperty('title', 'Mine')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByTestId('save-status')).toHaveTextContent('Saved')
  })

  it('Reload latest calls onReload', async () => {
    const onReload = vi.fn()
    await renderReady(onReload)
    fetchMock.mockResolvedValue(
      jsonResponse(409, { error: { code: 'note_conflict', message: 'x', detail: {} } })
    )
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Mine' } })
    await act(() => vi.advanceTimersByTimeAsync(1500))
    fireEvent.click(screen.getByRole('button', { name: 'Reload latest' }))
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('full-width toggle switches layout and persists in localStorage', async () => {
    const { unmount } = await renderReady()
    const body = screen.getByRole('main')
    expect(body).toHaveAttribute('data-full-width', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Full width' }))
    expect(body).toHaveAttribute('data-full-width', 'true')
    expect(window.localStorage.getItem(FULL_WIDTH_STORAGE_KEY)).toBe('1')
    expect(screen.getByRole('button', { name: 'Narrow' })).toHaveAttribute('aria-pressed', 'true')

    // A fresh mount (page reload) restores the preference.
    unmount()
    await renderReady()
    expect(screen.getByRole('main')).toHaveAttribute('data-full-width', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Narrow' }))
    expect(window.localStorage.getItem(FULL_WIDTH_STORAGE_KEY)).toBe('0')
  })

  it('still toggles when localStorage is unavailable', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    await renderReady()
    fireEvent.click(screen.getByRole('button', { name: 'Full width' }))
    expect(screen.getByRole('main')).toHaveAttribute('data-full-width', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Narrow' }))
    getItem.mockRestore()
    setItem.mockRestore()
  })
})
