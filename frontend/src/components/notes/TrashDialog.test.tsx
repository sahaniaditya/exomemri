import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import TrashDialog from './TrashDialog'
import { jsonResponse, pageFor, stubFetch } from './testUtils'

const onClose = vi.fn()
const onRestored = vi.fn()

const trashed = [
  { id: 't1', title: 'Old notes', icon: '📘', parent_id: null, deleted_at: '2026-10-01T10:00:00+00:00' },
  { id: 't2', title: 'Draft', icon: null, parent_id: null, deleted_at: null },
]

const ui = (open = true) => (
  <TrashDialog spaceId="s1" open={open} onClose={onClose} onRestored={onRestored} />
)

beforeEach(() => {
  onClose.mockReset()
  onRestored.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('TrashDialog', () => {
  it('renders nothing and makes no request while closed', () => {
    const { calls } = stubFetch(() => jsonResponse(200, { items: [] }))
    render(ui(false))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('lists trashed pages', async () => {
    stubFetch(() => jsonResponse(200, { items: trashed }))
    render(ui())
    expect(screen.getByRole('dialog', { name: 'Trash' })).toBeInTheDocument()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByText('Old notes')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText(/^Deleted /)).toBeInTheDocument()
  })

  it('shows an empty state', async () => {
    stubFetch(() => jsonResponse(200, { items: [] }))
    render(ui())
    expect(await screen.findByText(/Trash is empty/)).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    stubFetch(() => jsonResponse(500, { error: { code: 'x', message: 'down' } }))
    render(ui())
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the trash.')
  })

  it('restores a page, tells the caller, and refreshes the list', async () => {
    let listed = 0
    const { calls } = stubFetch(({ url }) => {
      if (url.endsWith('/restore')) return jsonResponse(200, pageFor('t1'))
      return jsonResponse(200, { items: listed++ === 0 ? trashed : [trashed[1]] })
    })
    render(ui())
    fireEvent.click(await screen.findByRole('button', { name: 'Restore Old notes' }))
    await waitFor(() => expect(screen.queryByText('Old notes')).not.toBeInTheDocument())
    expect(onRestored).toHaveBeenCalledWith('t1')
    expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([
      'GET /api/spaces/s1/notes/trash',
      'POST /api/spaces/s1/notes/t1/restore',
      'GET /api/spaces/s1/notes/trash',
    ])
  })

  it('a failed restore keeps the page and reports the error', async () => {
    stubFetch(({ url }) =>
      url.endsWith('/restore')
        ? jsonResponse(404, { error: { code: 'not_found', message: 'gone' } })
        : jsonResponse(200, { items: trashed })
    )
    render(ui())
    fireEvent.click(await screen.findByRole('button', { name: 'Restore Old notes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not restore')
    expect(screen.getByText('Old notes')).toBeInTheDocument()
    expect(onRestored).not.toHaveBeenCalled()
  })

  it('delete forever needs confirmation and can be cancelled', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, { items: trashed }))
    render(ui())
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Old notes forever' }))
    expect(calls.filter(c => c.method === 'DELETE')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Confirm delete' })).not.toBeInTheDocument()
    expect(calls.filter(c => c.method === 'DELETE')).toHaveLength(0)
  })

  it('confirming deletes the page permanently', async () => {
    let listed = 0
    const { calls } = stubFetch(({ method }) =>
      method === 'DELETE'
        ? jsonResponse(204)
        : jsonResponse(200, { items: listed++ === 0 ? trashed : [trashed[1]] })
    )
    render(ui())
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Old notes forever' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    await waitFor(() => expect(screen.queryByText('Old notes')).not.toBeInTheDocument())
    expect(calls.find(c => c.method === 'DELETE')).toMatchObject({
      url: '/api/spaces/s1/notes/trash/t1',
    })
  })

  it('a failed permanent delete shows an error and keeps the row', async () => {
    stubFetch(({ method }) =>
      method === 'DELETE'
        ? jsonResponse(500, { error: { code: 'x', message: 'nope' } })
        : jsonResponse(200, { items: trashed })
    )
    render(ui())
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Old notes forever' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete')
    expect(screen.getByText('Old notes')).toBeInTheDocument()
  })

  it('closes with the close button and Escape', async () => {
    stubFetch(() => jsonResponse(200, { items: [] }))
    render(ui())
    await screen.findByText(/Trash is empty/)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
