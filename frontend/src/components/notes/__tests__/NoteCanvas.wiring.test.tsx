import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { jsonResponse } from './jsdomStubs'

const DOC = { type: 'doc', content: [{ type: 'paragraph' }] }
const EDITED = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'edited' }] }],
}

// The real editor is covered in NoteEditorCore.test; here only the canvas wiring is under test.
const core = vi.hoisted(() => ({
  props: null as null | {
    onChange: () => void
    onBlur?: () => void
    onEditorReady?: (e: Editor | null) => void
  },
}))

vi.mock('../NoteEditorCore', () => ({
  default: (props: NonNullable<typeof core.props>) => {
    core.props = props
    return <div data-testid="core" />
  },
}))

// Panels and tools mounted by the canvas have their own tests; stub them so these tests stay on autosave.
vi.mock('../AiAssistMenu', () => ({ default: () => null }))
vi.mock('../BacklinksPanel', () => ({ default: () => null }))
vi.mock('../LinkPicker', () => ({ default: () => null }))
vi.mock('../NoteBlockTools', () => ({ default: () => null }))
vi.mock('../NoteHeaderMeta', () => ({ default: () => null }))
vi.mock('../OutlinePanel', () => ({ default: () => null }))
vi.mock('../VersionHistory', () => ({ default: () => null }))
vi.mock('../hooks/useIdleSnapshot', () => ({ useIdleSnapshot: () => undefined }))

import NoteCanvas from '../NoteCanvas'

const NOTE = {
  id: 'n1',
  title: 'Title',
  content: DOC,
  sort_order: 0,
  updated_at: 'T0',
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ...NOTE, updated_at: 'T1' }))
  vi.stubGlobal('fetch', fetchMock)
  vi.useFakeTimers()
  core.props = null
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function mount() {
  render(<NoteCanvas spaceId="s1" spaceName="Space" note={NOTE} />)
  act(() => {
    core.props?.onEditorReady?.({ getJSON: () => EDITED } as unknown as Editor)
  })
}

const sentBody = (call: number) =>
  JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string)

describe('NoteCanvas editor wiring', () => {
  it('saves editor content after the debounce with the loaded updated_at', async () => {
    mount()
    act(() => core.props?.onChange())
    expect(screen.getByTestId('save-status')).toHaveTextContent('Unsaved changes')
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sentBody(0)).toEqual({ content: EDITED, expected_updated_at: 'T0' })
    expect(screen.getByTestId('save-status')).toHaveTextContent('Saved')
  })

  it('flushes immediately when the editor blurs', async () => {
    mount()
    act(() => core.props?.onChange())
    await act(async () => core.props?.onBlur?.())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sentBody(0).content).toEqual(EDITED)
  })

  it('sends title and content together when both changed', async () => {
    mount()
    act(() => core.props?.onChange())
    await act(async () => {
      const input = screen.getByLabelText('Page title') as HTMLInputElement
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, 'Renamed')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sentBody(0)).toMatchObject({ title: 'Renamed', content: EDITED })
  })

  it('flushes a pending edit when the canvas unmounts', () => {
    const { unmount } = render(<NoteCanvas spaceId="s1" spaceName="Space" note={NOTE} />)
    act(() => {
      core.props?.onEditorReady?.({ getJSON: () => EDITED } as unknown as Editor)
      core.props?.onChange()
    })
    unmount()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0][1] as RequestInit).keepalive).toBe(true)
  })
})
