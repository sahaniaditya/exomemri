import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import VersionHistory from './VersionHistory'

const NOW = Date.now()
const VERSIONS = [
  { id: 'v2', title: 'Newer', reason: 'idle', created_at: new Date(NOW - 5 * 60_000).toISOString() },
  { id: 'v1', title: 'Older', reason: 'pre_restore', created_at: new Date(NOW - 3 * 3600_000).toISOString() },
]
const FULL: Record<string, unknown> = {
  v1: {
    ...VERSIONS[1],
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Old heading' }] },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'old body', marks: [{ type: 'bold' }] }],
        },
      ],
    },
  },
  v2: { ...VERSIONS[0], content: { type: 'doc', content: [] } },
}
const RESTORED = {
  id: 'n1',
  space_id: 's1',
  title: 'Older',
  content: { type: 'doc' },
  sort_order: 0,
  updated_at: 'x',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>
function stubFetch(handler: Handler) {
  const fn = vi.fn((url: string, init?: RequestInit) => Promise.resolve(handler(url, init)))
  vi.stubGlobal('fetch', fn)
  return fn
}

const BASE = '/api/spaces/s1/notes/n1/versions'

function defaultHandler(url: string, init?: RequestInit): Response {
  if (url === BASE) return json({ items: VERSIONS })
  if (url === `${BASE}/v1/restore` && init?.method === 'POST') return json(RESTORED)
  const id = url.replace(`${BASE}/`, '')
  if (FULL[id]) return json(FULL[id])
  return json({}, 404)
}

function setup(props: Partial<React.ComponentProps<typeof VersionHistory>> = {}) {
  const onRestored = vi.fn()
  const onClose = vi.fn()
  render(
    <VersionHistory
      spaceId="s1"
      noteId="n1"
      open
      onClose={onClose}
      onRestored={onRestored}
      {...props}
    />
  )
  return { onRestored, onClose }
}

beforeEach(() => {
  stubFetch(defaultHandler)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('VersionHistory', () => {
  it('renders nothing and does not fetch while closed', () => {
    const fetchMock = stubFetch(defaultHandler)
    setup({ open: false })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows loading, then versions with relative time and reason', async () => {
    setup()
    expect(screen.getByText('Loading versions…')).toBeInTheDocument()
    expect(await screen.findByText('Newer')).toBeInTheDocument()
    expect(screen.getByText('5m ago · Auto-saved')).toBeInTheDocument()
    expect(screen.getByText('3h ago · Before a restore')).toBeInTheDocument()
    expect(screen.getByText('Select a version to preview it.')).toBeInTheDocument()
  })

  it('shows an empty state', async () => {
    stubFetch(() => json({ items: [] }))
    setup()
    expect(await screen.findByText(/No versions yet/)).toBeInTheDocument()
  })

  it('shows an error and retries the list', async () => {
    let fail = true
    stubFetch(url => (fail ? json({}, 500) : defaultHandler(url)))
    setup()
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load version history")
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Newer')).toBeInTheDocument()
  })

  it('shows a network failure as the same error state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    setup()
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load version history")
  })

  it('previews the selected version read-only', async () => {
    setup()
    fireEvent.click(await screen.findByRole('button', { name: /Older/ }))
    expect(await screen.findByText('Old heading')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Old heading' })).toBeInTheDocument()
    expect(screen.getByText('old body').closest('strong')).not.toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('shows an empty-version preview and a preview error', async () => {
    setup()
    fireEvent.click(await screen.findByRole('button', { name: /Newer/ }))
    expect(await screen.findByText('This version is empty.')).toBeInTheDocument()

    stubFetch(url => (url === BASE ? json({ items: VERSIONS }) : json({}, 500)))
    fireEvent.click(screen.getByRole('button', { name: /Older/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load this version")
  })

  it('requires confirmation before restoring, then reports the restored page', async () => {
    const fetchMock = stubFetch(defaultHandler)
    const { onRestored } = setup()
    fireEvent.click(await screen.findByRole('button', { name: /Older/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Restore this version' }))

    expect(screen.getByText(/Replace this note with the selected version/)).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/restore'))).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Yes, restore' }))
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith(RESTORED))
    const restoreCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/restore'))!
    expect(restoreCall[0]).toBe(`${BASE}/v1/restore`)
    expect(restoreCall[1]?.method).toBe('POST')
    // The list is reloaded so the pre_restore snapshot shows up.
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([u]) => u === BASE).length).toBeGreaterThanOrEqual(2)
    )
  })

  it('cancelling the confirmation restores nothing', async () => {
    const fetchMock = stubFetch(defaultHandler)
    const { onRestored } = setup()
    fireEvent.click(await screen.findByRole('button', { name: /Older/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Restore this version' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Restore this version' })).toBeInTheDocument()
    expect(onRestored).not.toHaveBeenCalled()
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/restore'))).toBe(false)
  })

  it('surfaces a restore failure without reporting success', async () => {
    stubFetch((url, init) =>
      url.endsWith('/restore') && init?.method === 'POST' ? json({}, 500) : defaultHandler(url, init)
    )
    const { onRestored } = setup()
    fireEvent.click(await screen.findByRole('button', { name: /Older/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Restore this version' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, restore' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't restore this version")
    expect(onRestored).not.toHaveBeenCalled()
  })

  it('closes via the Close button', async () => {
    const { onClose } = setup()
    await screen.findByText('Newer')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})
