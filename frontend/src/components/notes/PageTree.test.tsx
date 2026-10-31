import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useNoteTree } from './hooks/useNoteTree'
import PageTree from './PageTree'
import { item, jsonResponse, pageFor, stubFetch } from './testUtils'
import type { NoteTreeItem } from '@/lib/notes/types'

// A{A1,A2}  B  C
const ITEMS: NoteTreeItem[] = [
  item('a', 0),
  item('a1', 0, 'a'),
  item('a2', 1, 'a'),
  item('b', 1),
  item('c', 2),
]

const onOpen = vi.fn()
const onTrashed = vi.fn()

function Harness({ items = ITEMS, activeId = null }: { items?: NoteTreeItem[]; activeId?: string | null }) {
  const tree = useNoteTree('s1', items)
  return <PageTree spaceId="s1" tree={tree} activeId={activeId} onOpen={onOpen} onTrashed={onTrashed} />
}

beforeEach(() => {
  onOpen.mockReset()
  onTrashed.mockReset()
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const openMenu = (title: string) =>
  fireEvent.click(screen.getByRole('button', { name: `Actions for ${title}` }))
const menuItem = (name: string) => screen.getByRole('menuitem', { name })

describe('PageTree rendering', () => {
  it('shows root pages, hides children until expanded, and links to pages', () => {
    render(<Harness />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.queryByText('A1')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^.*B$/ })).toHaveAttribute(
      'href',
      '/dashboard/spaces/s1/notes/b'
    )
  })

  it('expands and collapses, and persists the choice per space', () => {
    const { unmount } = render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Expand A' }))
    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getByText('A2')).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem('atlas.notes.expanded.s1')!)).toEqual(['a'])
    unmount()

    render(<Harness />)
    expect(screen.getByText('A1')).toBeInTheDocument() // restored
    fireEvent.click(screen.getByRole('button', { name: 'Collapse A' }))
    expect(screen.queryByText('A1')).not.toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem('atlas.notes.expanded.s1')!)).toEqual([])
  })

  it('works when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Expand A' }))
    expect(screen.getByText('A1')).toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it('marks the open page and auto-expands its parent', () => {
    render(<Harness activeId="a2" />)
    const link = screen.getByRole('link', { name: /A2/ })
    expect(link).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /^.*B$/ })).not.toHaveAttribute('aria-current')
  })

  it('shows an empty state and still offers New page', () => {
    render(<Harness items={[]} />)
    expect(screen.getByText(/No pages yet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /New page/ })).toBeInTheDocument()
  })

  it('shows the page icon or a default', () => {
    render(<Harness items={[item('x', 0, null, 'X', '📘'), item('y', 1)]} />)
    expect(screen.getByText('📘')).toBeInTheDocument()
    expect(screen.getByText('📄')).toBeInTheDocument()
  })
})

describe('PageTree actions', () => {
  it('New page creates a root page and opens it', async () => {
    const { calls } = stubFetch(() => jsonResponse(201, pageFor('new', { title: 'Untitled' })))
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /New page/ }))
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('new'))
    expect(calls[0]).toEqual({
      url: '/api/spaces/s1/notes/pages',
      method: 'POST',
      body: { title: 'Untitled', parent_id: null },
    })
    expect(screen.getByText('Untitled')).toBeInTheDocument()
  })

  it('"+" adds a sub-page under that page, expands it and opens it', async () => {
    const { calls } = stubFetch(() =>
      jsonResponse(201, pageFor('kid', { title: 'Untitled', parent_id: 'b' }))
    )
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Add sub-page to B' }))
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('kid'))
    expect(calls[0].body).toEqual({ title: 'Untitled', parent_id: 'b' })
    expect(screen.getByText('Untitled')).toBeInTheDocument() // visible: parent expanded
  })

  it('children have no "+" button (one level only)', () => {
    render(<Harness activeId="a1" />)
    expect(screen.queryByRole('button', { name: 'Add sub-page to A1' })).not.toBeInTheDocument()
  })

  it('shows an error and no navigation when creation fails', async () => {
    stubFetch(() => jsonResponse(409, { error: { code: 'conflict', message: 'Page limit reached.' } }))
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /New page/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Page limit reached.')
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renames inline with Enter', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, pageFor('b', { title: 'Renamed' })))
    render(<Harness />)
    openMenu('B')
    fireEvent.click(menuItem('Rename'))
    const input = screen.getByRole('textbox', { name: 'Rename B' })
    fireEvent.change(input, { target: { value: '  Renamed  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText('Renamed')).toBeInTheDocument())
    expect(calls).toEqual([
      { url: '/api/spaces/s1/notes/pages/b', method: 'PATCH', body: { title: 'Renamed' } },
    ])
  })

  it('renames on double click and saves on blur', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, pageFor('c', { title: 'Cee' })))
    render(<Harness />)
    fireEvent.doubleClick(screen.getByRole('link', { name: /C$/ }))
    const input = screen.getByRole('textbox', { name: 'Rename C' })
    fireEvent.change(input, { target: { value: 'Cee' } })
    fireEvent.blur(input)
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toEqual({ title: 'Cee' })
  })

  it('Escape, blank or unchanged titles do not call the API', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, pageFor('b')))
    render(<Harness />)
    for (const [value, key] of [
      ['Changed', 'Escape'],
      ['   ', 'Enter'],
      ['B', 'Enter'],
    ] as const) {
      openMenu('B')
      fireEvent.click(menuItem('Rename'))
      const input = screen.getByRole('textbox', { name: 'Rename B' })
      fireEvent.change(input, { target: { value } })
      fireEvent.keyDown(input, { key })
    }
    await Promise.resolve()
    expect(calls).toHaveLength(0)
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('a failed rename rolls back via refetch and shows the error', async () => {
    const { calls } = stubFetch(({ method, url }) =>
      method === 'PATCH'
        ? jsonResponse(500, { error: { code: 'x', message: 'Boom' } })
        : url.endsWith('/tree')
          ? jsonResponse(200, { items: ITEMS })
          : jsonResponse(404)
    )
    render(<Harness />)
    openMenu('B')
    fireEvent.click(menuItem('Rename'))
    const input = screen.getByRole('textbox', { name: 'Rename B' })
    fireEvent.change(input, { target: { value: 'Nope' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom')
    await waitFor(() => expect(screen.getByText('B')).toBeInTheDocument())
    expect(screen.queryByText('Nope')).not.toBeInTheDocument()
    expect(calls.map(c => c.method)).toEqual(['PATCH', 'GET'])
  })

  it('Move to… lists valid targets and moves the page under the chosen parent', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, pageFor('b')))
    render(<Harness />)
    openMenu('B')
    fireEvent.click(menuItem('Move to…'))
    // A and C are valid roots; B itself is not offered
    expect(screen.getByRole('menuitem', { name: /A$/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /C$/ })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /B$/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: /C$/ }))
    await waitFor(() => expect(calls.length).toBeGreaterThan(0))
    expect(calls[0]).toEqual({
      url: '/api/spaces/s1/notes/pages/b',
      method: 'PATCH',
      body: { parent_id: 'c', sort_order: 0 },
    })
    // B is now nested under C, which was expanded to show it
    expect(screen.getByRole('button', { name: 'Collapse C' })).toBeInTheDocument()
    expect(screen.getByTestId('row-b').closest('ul')).toHaveAttribute('role', 'group')
  })

  it('Move to… offers Top level for a child, and nothing for a page with sub-pages', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, pageFor('a1')))
    render(<Harness activeId="a1" />)
    openMenu('A1')
    fireEvent.click(menuItem('Move to…'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Top level' }))
    await waitFor(() => expect(calls.length).toBeGreaterThan(0))
    expect(calls[0].body).toEqual({ parent_id: null, sort_order: 3 })

    cleanup()
    render(<Harness />)
    openMenu('A')
    fireEvent.click(menuItem('Move to…'))
    expect(screen.getByText('Pages with sub-pages stay at the top level')).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /B$/ })).not.toBeInTheDocument()
  })

  it('Duplicate adds the copy and opens it', async () => {
    const { calls } = stubFetch(() => jsonResponse(201, pageFor('b2', { title: 'B (copy)' })))
    render(<Harness />)
    openMenu('B')
    fireEvent.click(menuItem('Duplicate'))
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('b2'))
    expect(calls[0]).toMatchObject({ url: '/api/spaces/s1/notes/b/duplicate', method: 'POST' })
    expect(screen.getByText('B (copy)')).toBeInTheDocument()
  })

  it('Move to trash removes the page and reports whether the open page went with it', async () => {
    const { calls } = stubFetch(() => jsonResponse(204))
    render(<Harness activeId="a1" />)
    openMenu('A')
    fireEvent.click(menuItem('Move to trash'))
    await waitFor(() => expect(screen.queryByText('A')).not.toBeInTheDocument())
    expect(calls[0]).toMatchObject({ url: '/api/spaces/s1/notes/a/trash', method: 'POST' })
    expect(onTrashed).toHaveBeenCalledWith('a', true) // open page A1 was a child of A

    openMenu('B')
    fireEvent.click(menuItem('Move to trash'))
    await waitFor(() => expect(onTrashed).toHaveBeenCalledWith('b', false))
  })

  it('restores the row and shows an error when trashing fails', async () => {
    stubFetch(() => jsonResponse(500, { error: { code: 'x', message: 'Cannot trash' } }))
    render(<Harness />)
    openMenu('B')
    fireEvent.click(menuItem('Move to trash'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot trash')
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(onTrashed).not.toHaveBeenCalled()
  })

  it('closes the menu on Escape', () => {
    render(<Harness />)
    openMenu('B')
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('PageTree drag and drop', () => {
  const dataTransfer = () => ({ setData: vi.fn(), effectAllowed: '', dropEffect: '' })

  /** jsdom drag events carry no coordinates; attach the pointer's clientY. */
  const drag = (kind: 'dragOver' | 'drop', el: HTMLElement, clientY: number) => {
    const event = createEvent[kind](el, { dataTransfer: dataTransfer() })
    Object.defineProperty(event, 'clientY', { value: clientY })
    fireEvent(el, event)
  }

  /** jsdom has no layout; give a row a 100px-high box starting at y=0. */
  const sizeRow = (id: string) => {
    const row = screen.getByTestId(`row-${id}`)
    row.getBoundingClientRect = () =>
      ({ top: 0, height: 100, left: 0, right: 100, bottom: 100, width: 100, x: 0, y: 0 }) as DOMRect
    return row
  }

  it('drops a page onto the middle of a root to nest it', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, pageFor('b')))
    render(<Harness />)
    const b = sizeRow('b')
    const c = sizeRow('c')
    fireEvent.dragStart(b, { dataTransfer: dataTransfer() })
    drag('dragOver', c, 50)
    expect(c).toHaveAttribute('data-drop', 'inside')
    drag('drop', c, 50)
    await waitFor(() => expect(calls.length).toBeGreaterThan(0))
    expect(calls[0]).toEqual({
      url: '/api/spaces/s1/notes/pages/b',
      method: 'PATCH',
      body: { parent_id: 'c', sort_order: 0 },
    })
  })

  it('drops above a row to reorder, renumbering siblings in order', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, pageFor('c')))
    render(<Harness />)
    const c = sizeRow('c')
    const a = sizeRow('a')
    fireEvent.dragStart(c, { dataTransfer: dataTransfer() })
    drag('dragOver', a, 5)
    expect(a).toHaveAttribute('data-drop', 'before')
    drag('drop', a, 5)
    await waitFor(() => expect(calls.length).toBe(3))
    expect(calls.map(c => [c.url.split('/').pop(), c.body])).toEqual([
      ['c', { parent_id: null, sort_order: 0 }],
      ['a', { parent_id: null, sort_order: 1 }],
      ['b', { parent_id: null, sort_order: 2 }],
    ])
  })

  it('does not accept an illegal drop (page with sub-pages into another page)', () => {
    const { calls } = stubFetch(() => jsonResponse(200, {}))
    render(<Harness />)
    const a = sizeRow('a')
    const b = sizeRow('b')
    fireEvent.dragStart(a, { dataTransfer: dataTransfer() })
    drag('dragOver', b, 50)
    expect(b).not.toHaveAttribute('data-drop')
    drag('drop', b, 50)
    expect(calls).toHaveLength(0)
  })

  it('clears the hint when the drag ends', () => {
    stubFetch(() => jsonResponse(200, {}))
    render(<Harness />)
    const b = sizeRow('b')
    const c = sizeRow('c')
    fireEvent.dragStart(b, { dataTransfer: dataTransfer() })
    drag('dragOver', c, 50)
    fireEvent.dragEnd(b)
    expect(c).not.toHaveAttribute('data-drop')
  })
})

describe('within', () => {
  it('keeps menus scoped to their row', () => {
    render(<Harness />)
    openMenu('B')
    expect(within(screen.getByTestId('row-b')).getByRole('menu')).toBeInTheDocument()
    expect(within(screen.getByTestId('row-c')).queryByRole('menu')).not.toBeInTheDocument()
  })
})
