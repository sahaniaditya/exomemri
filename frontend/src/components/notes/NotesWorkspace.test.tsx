import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const push = vi.fn()
let params: { noteId?: string } = {}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useParams: () => params,
}))

import NotesWorkspace from './NotesWorkspace'
import { useNotesWorkspace } from './NotesWorkspaceContext'
import { item, jsonResponse, pageFor, stubFetch } from './testUtils'

const ITEMS = [item('a', 0, null, 'Alpha'), item('b', 1, null, 'Beta')]

function Probe() {
  const ws = useNotesWorkspace()
  return (
    <div>
      <span data-testid="space">{ws?.spaceId}</span>
      <button onClick={() => ws?.tree.patchLocal('a', { title: 'Alpha renamed', icon: '🔥' })}>
        rename-from-page
      </button>
    </div>
  )
}

const ui = (props: Partial<React.ComponentProps<typeof NotesWorkspace>> = {}) => (
  <NotesWorkspace spaceId="s1" initialItems={ITEMS} {...props}>
    <Probe />
  </NotesWorkspace>
)

beforeEach(() => {
  push.mockReset()
  params = {}
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('NotesWorkspace', () => {
  it('renders the tree beside the page content and shares context with it', () => {
    render(ui())
    expect(screen.getByRole('navigation', { name: 'Pages' })).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByTestId('space')).toHaveTextContent('s1')
  })

  it('lets the open page update the sidebar (title / icon) without a request', () => {
    const { calls } = stubFetch(() => jsonResponse(200, {}))
    render(ui())
    fireEvent.click(screen.getByText('rename-from-page'))
    expect(screen.getByText('Alpha renamed')).toBeInTheDocument()
    expect(screen.getByText('🔥')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('marks the page from the URL as active and records it as recent', () => {
    params = { noteId: 'b' }
    render(ui())
    expect(screen.getByRole('link', { name: /Beta/ })).toHaveAttribute('aria-current', 'page')
    expect(JSON.parse(window.localStorage.getItem('atlas.notes.recent.s1')!)).toEqual([
      { id: 'b', title: 'Beta', icon: null },
    ])
  })

  it('Ctrl+K and Cmd+K toggle the switcher; choosing a page navigates', async () => {
    stubFetch(() => jsonResponse(200, { items: [] }))
    window.localStorage.setItem(
      'atlas.notes.recent.s1',
      JSON.stringify([{ id: 'b', title: 'Beta', icon: null }])
    )
    render(ui())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByRole('dialog', { name: 'Search pages' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'K', metaKey: true })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.click(screen.getByRole('option', { name: /Beta/ }))
    expect(push).toHaveBeenCalledWith('/dashboard/spaces/s1/notes/b')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('a plain "k" does not open the switcher', () => {
    render(ui())
    fireEvent.keyDown(window, { key: 'k' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Search and Trash buttons open their dialogs', async () => {
    stubFetch(() => jsonResponse(200, { items: [] }))
    render(ui())
    fireEvent.click(screen.getByRole('button', { name: /Search/ }))
    expect(screen.getByRole('dialog', { name: 'Search pages' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: /Trash/ }))
    expect(screen.getByRole('dialog', { name: 'Trash' })).toBeInTheDocument()
    await act(async () => {})
  })

  it('restoring from the trash refreshes the tree', async () => {
    const trashed = [{ id: 'z', title: 'Zed', icon: null, parent_id: null, deleted_at: null }]
    const { calls } = stubFetch(({ url }) => {
      if (url.endsWith('/restore')) return jsonResponse(200, pageFor('z'))
      if (url.endsWith('/trash')) return jsonResponse(200, { items: trashed })
      if (url.endsWith('/tree')) return jsonResponse(200, { items: [...ITEMS, item('z', 2, null, 'Zed')] })
      return jsonResponse(404)
    })
    render(ui())
    fireEvent.click(screen.getByRole('button', { name: /Trash/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Restore Zed' }))
    expect(await screen.findByRole('link', { name: /Zed/ })).toBeInTheDocument()
    expect(calls.some(c => c.url.endsWith('/tree'))).toBe(true)
  })

  it('opens and closes the mobile drawer', () => {
    render(ui())
    const sidebar = screen.getByRole('complementary', { name: 'Notes sidebar' })
    expect(sidebar.className).not.toContain('sidebarOpen')
    fireEvent.click(screen.getByRole('button', { name: 'Open pages' }))
    expect(sidebar.className).toContain('sidebarOpen')
    fireEvent.click(screen.getByTestId('drawer-backdrop'))
    expect(sidebar.className).not.toContain('sidebarOpen')
    expect(screen.queryByTestId('drawer-backdrop')).not.toBeInTheDocument()
  })

  it('closes the drawer after navigating from it', () => {
    stubFetch(() => jsonResponse(201, pageFor('new', { title: 'Untitled' })))
    render(ui())
    fireEvent.click(screen.getByRole('button', { name: 'Open pages' }))
    fireEvent.click(screen.getByRole('button', { name: /New page/ }))
    return vi.waitFor(() => {
      expect(push).toHaveBeenCalledWith('/dashboard/spaces/s1/notes/new')
      expect(screen.queryByTestId('drawer-backdrop')).not.toBeInTheDocument()
    })
  })

  it('shows a load error from the server instead of a silent empty tree', () => {
    render(ui({ initialItems: [], loadFailed: true }))
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load your pages')
  })

  it('trashing the open page sends the user back to the space', async () => {
    params = { noteId: 'a' }
    stubFetch(() => jsonResponse(204))
    render(ui())
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Alpha' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to trash' }))
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/spaces/s1'))
  })

  it('trashing some other page leaves the user where they are', async () => {
    params = { noteId: 'a' }
    stubFetch(() => jsonResponse(204))
    render(ui())
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Beta' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to trash' }))
    await vi.waitFor(() => expect(screen.queryByText('Beta')).not.toBeInTheDocument())
    expect(push).not.toHaveBeenCalled()
  })
})
