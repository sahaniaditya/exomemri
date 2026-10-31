import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { Editor, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import MentionPicker, { type MentionPickerHandle } from '../MentionPicker'
import LinkPicker from '../LinkPicker'
import { captureExtensions } from './captureExtensions'
import { insertMention, mentionContent } from './mentionSuggestion'
import { captureSlashItems } from '../slash/items-capture'
import {
  clearLinkablesCache,
  filterLinkables,
  getNoteIdFromPath,
  getSpaceIdFromPath,
  loadLinkables,
  type LinkableItem,
} from '@/lib/notes/linkables'
import { LINK_PICKER_EVENT, linkNodeFor } from '@/lib/notes/linkPicker'
import { jsonResponse, stubFetch } from '../testUtils'

const SRC = '11111111-1111-4111-8111-111111111111'
const NOTE = '22222222-2222-4222-8222-222222222222'

const ITEMS: LinkableItem[] = [
  { kind: 'source', id: SRC, title: 'Raft video', detail: 'youtube' },
  { kind: 'source', id: 's2', title: 'Paxos article', detail: 'article' },
  { kind: 'note', id: NOTE, title: 'Raft notes', detail: '📘' },
  { kind: 'note', id: 'n3', title: 'Distributed systems', detail: null },
]

let editor: Editor | null = null
const makeEditor = (content?: JSONContent) =>
  (editor = new Editor({
    extensions: [StarterKit, ...captureExtensions({ spaceId: 's1' })],
    content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
  }))

beforeEach(() => clearLinkablesCache())
afterEach(() => {
  cleanup()
  editor?.destroy()
  editor = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.history.replaceState({}, '', '/')
})

describe('path helpers', () => {
  it('extract the space and note ids', () => {
    expect(getSpaceIdFromPath('/dashboard/spaces/abc/notes/def')).toBe('abc')
    expect(getNoteIdFromPath('/dashboard/spaces/abc/notes/def')).toBe('def')
    expect(getNoteIdFromPath('/dashboard/spaces/abc')).toBeNull()
    expect(getSpaceIdFromPath('/login')).toBeNull()
  })
})

describe('filterLinkables', () => {
  it('returns the first results for an empty query', () => {
    expect(filterLinkables(ITEMS, '')).toHaveLength(4)
    expect(filterLinkables(ITEMS, '  ', 2)).toHaveLength(2)
  })

  it('matches case-insensitively, prefix matches first', () => {
    const titles = filterLinkables(ITEMS, 'RAFT').map(i => i.title)
    expect(titles).toEqual(['Raft video', 'Raft notes'])
    expect(filterLinkables(ITEMS, 'systems').map(i => i.id)).toEqual(['n3'])
    const mixed: LinkableItem[] = [
      { kind: 'note', id: '1', title: 'Zebra', detail: null },
      { kind: 'note', id: '2', title: 'Alpha', detail: null },
    ]
    expect(filterLinkables(mixed, 'a').map(i => i.title)).toEqual(['Alpha', 'Zebra'])
  })

  it('returns nothing when there is no match and honors the limit', () => {
    expect(filterLinkables(ITEMS, 'zzz')).toEqual([])
    expect(filterLinkables(ITEMS, 'r', 1)).toHaveLength(1)
  })
})

describe('loadLinkables', () => {
  const route = ({ url }: { url: string }) =>
    url.endsWith('/sources')
      ? jsonResponse(200, { sources: [{ id: SRC, title: 'Raft video', type: 'youtube' }] })
      : jsonResponse(200, { items: [{ id: NOTE, title: 'Raft notes', icon: '📘', parent_id: null, sort_order: 0, updated_at: null }] })

  it('merges captures and pages, caches, and can exclude the open page', async () => {
    const { calls } = stubFetch(route)
    const first = await loadLinkables('s1')
    expect(first).toEqual([
      { kind: 'source', id: SRC, title: 'Raft video', detail: 'youtube' },
      { kind: 'note', id: NOTE, title: 'Raft notes', detail: '📘' },
    ])
    await loadLinkables('s1')
    expect(calls).toHaveLength(2) // one fetch per source, second call served from cache
    expect((await loadLinkables('s1', NOTE)).map(i => i.id)).toEqual([SRC])
  })

  it('rejects when the backend fails (callers degrade to no results)', async () => {
    stubFetch(() => jsonResponse(500))
    await expect(loadLinkables('s1')).rejects.toBeTruthy()
  })
})

describe('mention suggestion output', () => {
  it('builds noteMention / sourceMention content plus a trailing space', () => {
    expect(mentionContent(ITEMS[2])).toEqual([
      { type: 'noteMention', attrs: { noteId: NOTE, title: 'Raft notes' } },
      { type: 'text', text: ' ' },
    ])
    expect(mentionContent(ITEMS[0])).toEqual([
      { type: 'sourceMention', attrs: { sourceId: SRC, title: 'Raft video' } },
      { type: 'text', text: ' ' },
    ])
  })

  it('replaces the typed "@query" with the mention', () => {
    makeEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'see @raf' }] }],
    })
    // "@raf" spans positions 5..9 (paragraph opens at 0, text starts at 1)
    insertMention(editor!, { from: 5, to: 9 }, ITEMS[2])
    expect(editor!.getJSON().content![0].content).toEqual([
      { type: 'text', text: 'see ' },
      { type: 'noteMention', attrs: { noteId: NOTE, title: 'Raft notes' } },
      { type: 'text', text: ' ' },
    ])
  })

  it('inserts a source mention the same way', () => {
    makeEditor()
    insertMention(editor!, { from: 1, to: 1 }, ITEMS[0])
    expect(editor!.getJSON().content![0].content![0]).toEqual({
      type: 'sourceMention',
      attrs: { sourceId: SRC, title: 'Raft video' },
    })
  })
})

describe('MentionPicker', () => {
  const setup = (items = ITEMS) => {
    const command = vi.fn()
    const ref = createRef<MentionPickerHandle>()
    render(<MentionPicker ref={ref} items={items} command={command} />)
    const key = (k: string) => {
      let handled = false
      act(() => {
        handled = ref.current!.onKeyDown(new KeyboardEvent('keydown', { key: k }))
      })
      return handled
    }
    return { command, key }
  }

  it('lists captures and pages with their kind', () => {
    setup()
    expect(screen.getAllByRole('option')).toHaveLength(4)
    expect(screen.getAllByText('Capture')).toHaveLength(2)
    expect(screen.getAllByText('Page')).toHaveLength(2)
  })

  it('arrow keys wrap and Enter / Tab choose the highlighted item', () => {
    const { command, key } = setup()
    expect(key('ArrowDown')).toBe(true)
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
    key('ArrowUp')
    key('ArrowUp') // wraps to last
    expect(screen.getAllByRole('option')[3]).toHaveAttribute('aria-selected', 'true')
    expect(key('Enter')).toBe(true)
    expect(command).toHaveBeenLastCalledWith(ITEMS[3])
    key('ArrowDown') // wraps to first
    key('Tab')
    expect(command).toHaveBeenLastCalledWith(ITEMS[0])
  })

  it('mouse selection works and unrelated keys are not handled', () => {
    const { command, key } = setup()
    fireEvent.mouseDown(screen.getByRole('option', { name: /Paxos article/ }))
    expect(command).toHaveBeenCalledWith(ITEMS[1])
    expect(key('a')).toBe(false)
  })

  it('shows an empty state and handles no keys', () => {
    const { key } = setup([])
    expect(screen.getByText('No matches')).toBeInTheDocument()
    expect(key('Enter')).toBe(false)
  })
})

describe('captureSlashItems', () => {
  it('exposes Capture and Link to page in the Captures group', () => {
    expect(captureSlashItems.map(i => [i.id, i.title, i.group])).toEqual([
      ['capture', 'Capture', 'Captures'],
      ['link-to-page', 'Link to page', 'Captures'],
    ])
    for (const entry of captureSlashItems) {
      expect(entry.keywords.length).toBeGreaterThan(0)
      expect(entry.icon).toBeTruthy()
    }
  })

  it('run() removes the slash text and asks the picker to open at that position', () => {
    makeEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi /cap' }] }],
    })
    editor!.commands.setTextSelection(8) // caret at the end of "/cap", as when typing
    const seen: unknown[] = []
    editor!.view.dom.addEventListener(LINK_PICKER_EVENT, e => seen.push((e as CustomEvent).detail))
    captureSlashItems[0].run({ editor: editor!, range: { from: 4, to: 8 } })
    expect(editor!.getText()).toBe('hi ')
    expect(seen).toEqual([{ mode: 'capture', pos: 4 }])
    captureSlashItems[1].run({ editor: editor!, range: { from: 1, to: 2 } })
    expect((seen[1] as { mode: string }).mode).toBe('page')
  })
})

describe('linkNodeFor', () => {
  it('maps the chosen item and mode to a node', () => {
    expect(linkNodeFor(ITEMS[0], 'capture')).toEqual({
      type: 'captureEmbed',
      attrs: { sourceId: SRC, title: 'Raft video', sourceType: 'youtube', timestampSec: null },
    })
    expect(linkNodeFor(ITEMS[0], 'page')).toEqual({
      type: 'sourceMention',
      attrs: { sourceId: SRC, title: 'Raft video' },
    })
    expect(linkNodeFor(ITEMS[2], 'page')).toEqual({
      type: 'noteMention',
      attrs: { noteId: NOTE, title: 'Raft notes' },
    })
  })
})

describe('LinkPicker', () => {
  const route = ({ url }: { url: string }) =>
    url.endsWith('/sources')
      ? jsonResponse(200, {
          sources: [
            { id: SRC, title: 'Raft video', type: 'youtube' },
            { id: 's2', title: 'Paxos article', type: 'article' },
          ],
        })
      : jsonResponse(200, {
          items: [
            { id: NOTE, title: 'Raft notes', icon: null, parent_id: null, sort_order: 0, updated_at: null },
          ],
        })

  async function open(mode: 'capture' | 'page') {
    stubFetch(route)
    makeEditor()
    render(<LinkPicker editor={editor} spaceId="s1" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => {
      editor!.view.dom.dispatchEvent(
        new CustomEvent(LINK_PICKER_EVENT, { bubbles: true, detail: { mode, pos: 1 } })
      )
    })
  }

  it('opens on the slash event and embeds the chosen capture', async () => {
    await open('capture')
    expect(screen.getByRole('dialog', { name: 'Embed a capture' })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: /Paxos article/ }))
    expect(editor!.getJSON().content!.map(n => n.type)).toContain('captureEmbed')
    const node = editor!.getJSON().content!.find(n => n.type === 'captureEmbed')!
    expect(node.attrs).toMatchObject({ sourceId: 's2', title: 'Paxos article', sourceType: 'article' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('lists only pages for "Link to page" and inserts a mention', async () => {
    await open('page')
    expect(screen.getByRole('dialog', { name: 'Link to a page' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Raft notes/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Raft video/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Raft notes/ }))
    expect(JSON.stringify(editor!.getJSON())).toContain('"noteMention"')
  })

  it('filters, and Enter picks the first match', async () => {
    await open('capture')
    await screen.findByRole('button', { name: /Raft video/ })
    const box = screen.getByRole('textbox', { name: 'Filter' })
    fireEvent.change(box, { target: { value: 'paxos' } })
    expect(screen.queryByRole('button', { name: /Raft video/ })).not.toBeInTheDocument()
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(JSON.stringify(editor!.getJSON())).toContain('Paxos article')
  })

  it('shows an empty state and Escape closes without inserting', async () => {
    await open('capture')
    await screen.findByRole('button', { name: /Raft video/ })
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter' }), { target: { value: 'nothing' } })
    expect(screen.getByText('No captures found.')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(JSON.stringify(editor!.getJSON())).not.toContain('captureEmbed')
  })

  it('reports a load failure', async () => {
    stubFetch(() => jsonResponse(500))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    makeEditor()
    render(<LinkPicker editor={editor} spaceId="s1" />)
    act(() => {
      editor!.view.dom.dispatchEvent(
        new CustomEvent(LINK_PICKER_EVENT, { bubbles: true, detail: { mode: 'page', pos: 1 } })
      )
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this space.')
  })

  it('renders nothing without an editor', () => {
    render(<LinkPicker editor={null} spaceId="s1" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
