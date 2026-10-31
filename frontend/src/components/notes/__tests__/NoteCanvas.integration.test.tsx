import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { jsonResponse } from './jsdomStubs'

const DOC = { type: 'doc', content: [{ type: 'paragraph' }] }
const EDITED = {
  type: 'doc',
  content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Edited' }] }],
}

// Everything the canvas mounts is stubbed; this file tests only how they are connected.
const probe = vi.hoisted(() => ({
  core: null as null | { onChange: () => void; onEditorReady?: (e: Editor | null) => void },
  header: null as null | Record<string, unknown>,
  blockTools: null as null | { editor: Editor | null },
  linkPicker: null as null | { editor: Editor | null; spaceId: string },
  ai: null as null | { editor: Editor | null; spaceId: string; noteId?: string },
  outline: null as null | { doc: unknown; editor: Editor | null },
  backlinks: null as null | { spaceId: string; noteId: string },
  history: null as null | {
    open: boolean
    spaceId: string
    noteId: string
    onClose: () => void
    onRestored: (page: unknown) => void
  },
}))

vi.mock('../NoteEditorCore', () => ({
  default: (props: NonNullable<typeof probe.core>) => {
    probe.core = props
    return <div data-testid="core" />
  },
}))
vi.mock('../NoteHeaderMeta', () => ({
  default: (props: Record<string, unknown>) => {
    probe.header = props
    return <div data-testid="header-meta" />
  },
}))
vi.mock('../NoteBlockTools', () => ({
  default: (props: NonNullable<typeof probe.blockTools>) => {
    probe.blockTools = props
    return null
  },
}))
vi.mock('../LinkPicker', () => ({
  default: (props: NonNullable<typeof probe.linkPicker>) => {
    probe.linkPicker = props
    return null
  },
}))
vi.mock('../AiAssistMenu', () => ({
  default: (props: NonNullable<typeof probe.ai>) => {
    probe.ai = props
    return null
  },
}))
vi.mock('../OutlinePanel', () => ({
  default: (props: NonNullable<typeof probe.outline>) => {
    probe.outline = props
    return <div data-testid="outline" />
  },
}))
vi.mock('../BacklinksPanel', () => ({
  default: (props: NonNullable<typeof probe.backlinks>) => {
    probe.backlinks = props
    return <div data-testid="backlinks" />
  },
}))
vi.mock('../VersionHistory', () => ({
  default: (props: NonNullable<typeof probe.history>) => {
    probe.history = props
    return props.open ? <div data-testid="history-open" /> : null
  },
}))
vi.mock('../hooks/useIdleSnapshot', () => ({ useIdleSnapshot: () => undefined }))

import NoteCanvas from '../NoteCanvas'
import { NotesWorkspaceContext, type NotesWorkspaceValue } from '../NotesWorkspaceContext'

const NOTE = {
  id: 'n1',
  title: 'Title',
  content: DOC,
  sort_order: 0,
  updated_at: 'T0',
  icon: '🧠',
  cover_key: 'notes/images/c.png',
  full_width: false,
}

let fetchMock: ReturnType<typeof vi.fn>
const fakeEditor = { getJSON: () => EDITED } as unknown as Editor
const patchLocal = vi.fn()

function mount(onReload?: () => void) {
  const workspace = {
    spaceId: 's1',
    tree: { patchLocal },
    openSwitcher: vi.fn(),
    openTrash: vi.fn(),
  } as unknown as NotesWorkspaceValue
  render(
    <NotesWorkspaceContext.Provider value={workspace}>
      <NoteCanvas spaceId="s1" spaceName="Space" note={NOTE} onReload={onReload} />
    </NotesWorkspaceContext.Provider>
  )
  act(() => probe.core?.onEditorReady?.(fakeEditor))
}

const putBodies = () =>
  fetchMock.mock.calls
    .filter(call => (call[1] as RequestInit | undefined)?.method === 'PUT')
    .map(call => JSON.parse((call[1] as RequestInit).body as string))

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...NOTE, updated_at: 'T1' }))
  vi.stubGlobal('fetch', fetchMock)
  vi.useFakeTimers()
  patchLocal.mockClear()
  for (const key of Object.keys(probe) as Array<keyof typeof probe>) probe[key] = null
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('NoteCanvas integration of the notes workspace', () => {
  it('gives the page settings, panels and tools the right props', () => {
    mount()
    expect(probe.header).toMatchObject({
      spaceId: 's1',
      noteId: 'n1',
      icon: '🧠',
      coverKey: 'notes/images/c.png',
    })
    expect(probe.blockTools?.editor).toBe(fakeEditor)
    expect(probe.linkPicker).toMatchObject({ spaceId: 's1', editor: fakeEditor })
    expect(probe.ai).toMatchObject({ spaceId: 's1', noteId: 'n1', editor: fakeEditor })
    expect(probe.outline?.editor).toBe(fakeEditor)
    expect(probe.backlinks).toMatchObject({ spaceId: 's1', noteId: 'n1' })
    expect(screen.getByTestId('outline')).toBeInTheDocument()
  })

  it('refreshes the outline document when the content changes', () => {
    mount()
    expect(probe.outline?.doc).toEqual(DOC)
    act(() => probe.core?.onChange())
    expect(probe.outline?.doc).toEqual(EDITED)
  })

  it('adopts the updated_at written by the header so the next save is not a conflict', async () => {
    mount()
    act(() =>
      (probe.header?.onSaved as (p: unknown) => void)({
        id: 'n1',
        icon: '🔥',
        cover_key: null,
        full_width: false,
        updated_at: 'T9',
      })
    )
    act(() => probe.core?.onChange())
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(putBodies()).toHaveLength(1)
    expect(putBodies()[0]).toMatchObject({ content: EDITED, expected_updated_at: 'T9' })
  })

  it('keeps the sidebar tree in step with icon and title changes', async () => {
    mount()
    act(() =>
      (probe.header?.onSaved as (p: unknown) => void)({
        id: 'n1',
        icon: '🔥',
        cover_key: null,
        full_width: false,
        updated_at: 'T9',
      })
    )
    expect(patchLocal).toHaveBeenCalledWith('n1', { icon: '🔥' })

    act(() => probe.core?.onChange())
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(patchLocal).toHaveBeenCalledWith('n1', { title: 'Title' })
  })

  it('opens version history from the top bar and reloads after a restore', () => {
    const onReload = vi.fn()
    mount(onReload)
    expect(screen.queryByTestId('history-open')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getByTestId('history-open')).toBeInTheDocument()
    expect(probe.history).toMatchObject({ spaceId: 's1', noteId: 'n1' })
    act(() => probe.history?.onRestored({ id: 'n1' }))
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('offers a Markdown export download for the page', () => {
    mount()
    expect(screen.getByRole('link', { name: 'Export' })).toHaveAttribute(
      'href',
      '/api/spaces/s1/notes/n1/export'
    )
  })

  it('applies the saved page width and saves it when toggled', async () => {
    mount()
    expect(screen.getByRole('button', { name: 'Full width' })).toHaveAttribute('aria-pressed', 'false')
    fetchMock.mockResolvedValue(jsonResponse(200, { ...NOTE, full_width: true, updated_at: 'T2' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Full width' }))
    })
    const patch = fetchMock.mock.calls.find(
      call => (call[1] as RequestInit | undefined)?.method === 'PATCH'
    )
    expect(patch?.[0]).toBe('/api/spaces/s1/notes/pages/n1')
    expect(JSON.parse((patch?.[1] as RequestInit).body as string)).toEqual({ full_width: true })
  })
})
