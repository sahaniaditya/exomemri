import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { NotePage } from '@/lib/notes'

const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import SpaceNotes from './SpaceNotes'

const page = (id: string, title: string, updated_at: string | null = null): NotePage => ({
  id,
  title,
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
  sort_order: 0,
  updated_at,
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  push.mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const renderList = (notes: NotePage[], loadError = false) =>
  render(<SpaceNotes spaceId="s1" initialNotes={notes} loadError={loadError} />)

describe('SpaceNotes list', () => {
  it('renders each note as a link to its page with a relative time', () => {
    const recent = new Date(Date.now() - 5 * 60_000).toISOString()
    renderList([page('n1', 'Alpha', recent), page('n2', 'Beta')])
    const alpha = screen.getByRole('link', { name: /Alpha/ })
    expect(alpha).toHaveAttribute('href', '/dashboard/spaces/s1/notes/n1')
    expect(alpha).toHaveTextContent('5m ago')
    expect(screen.getByRole('link', { name: /Beta/ })).toHaveAttribute(
      'href',
      '/dashboard/spaces/s1/notes/n2'
    )
  })

  it('no longer renders an inline editor on the Space page', () => {
    renderList([page('n1', 'Alpha')])
    expect(document.querySelector('.ProseMirror')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument()
  })

  it('shows the empty state, and a load-error variant', () => {
    const { unmount } = renderList([])
    expect(screen.getByText('Start your first page')).toBeInTheDocument()
    unmount()
    renderList([], true)
    expect(screen.getByText('Couldn’t load notes')).toBeInTheDocument()
  })
})

describe('SpaceNotes new page', () => {
  it('posts then navigates to the new page', async () => {
    fetchMock.mockResolvedValue(json(201, page('new1', 'Untitled')))
    renderList([page('n1', 'Alpha')])
    fireEvent.click(screen.getByRole('button', { name: /New page/ }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/spaces/s1/notes/new1'))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/spaces/s1/notes')
    expect((init as RequestInit).method).toBe('POST')
  })

  it.each([
    [409, 'This space already has the maximum number of pages (50).'],
    [401, 'Your session has expired. Please log in again.'],
    [500, 'Could not create a page. Please try again.'],
  ])('shows an error for a %s and does not navigate', async (status, message) => {
    fetchMock.mockResolvedValue(json(status, {}))
    renderList([])
    fireEvent.click(screen.getByRole('button', { name: /New page/ }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('shows an error when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'))
    renderList([])
    fireEvent.click(screen.getByRole('button', { name: /New page/ }))
    expect(await screen.findByText('Could not reach the server. Please try again.')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})

describe('SpaceNotes rename', () => {
  it('renames through PUT and updates the row', async () => {
    fetchMock.mockResolvedValue(json(200, { ...page('n1', 'Gamma'), updated_at: '2026-10-31T10:00:00Z' }))
    renderList([page('n1', 'Alpha')])
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const input = screen.getByLabelText('Page name')
    expect(input).toHaveValue('Alpha')
    fireEvent.change(input, { target: { value: '  Gamma  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByRole('link', { name: /Gamma/ })).toBeInTheDocument()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/spaces/s1/notes/n1')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ title: 'Gamma' })
  })

  it('rejects an empty name without calling the server', () => {
    renderList([page('n1', 'Alpha')])
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    fireEvent.change(screen.getByLabelText('Page name'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Give this page a name.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows an error when the rename fails and Escape cancels', async () => {
    fetchMock.mockResolvedValue(json(500, {}))
    renderList([page('n1', 'Alpha')])
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    fireEvent.change(screen.getByLabelText('Page name'), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Could not rename the page. Please try again.')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByLabelText('Page name'), { key: 'Escape' })
    expect(screen.getByRole('link', { name: /Alpha/ })).toBeInTheDocument()
  })
})

describe('SpaceNotes delete', () => {
  it('does nothing when the confirmation is declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderList([page('n1', 'Alpha')])
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(window.confirm).toHaveBeenCalledWith('Delete “Alpha”? This page is removed permanently.')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: /Alpha/ })).toBeInTheDocument()
  })

  it('deletes after confirmation and removes the row', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    renderList([page('n1', 'Alpha'), page('n2', 'Beta')])
    const row = screen.getByRole('link', { name: /Alpha/ }).closest('div')!.parentElement!
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /Alpha/ })).not.toBeInTheDocument()
    )
    expect(screen.getByRole('link', { name: /Beta/ })).toBeInTheDocument()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/spaces/s1/notes/n1')
    expect((init as RequestInit).method).toBe('DELETE')
  })

  it('keeps the row and shows an error when deleting fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fetchMock.mockResolvedValue(json(500, {}))
    renderList([page('n1', 'Alpha')])
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Could not delete the page. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Alpha/ })).toBeInTheDocument()
  })

  it('shows a session message on 401', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fetchMock.mockResolvedValue(json(401, {}))
    renderList([page('n1', 'Alpha')])
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Your session has expired. Please log in again.')).toBeInTheDocument()
  })
})
