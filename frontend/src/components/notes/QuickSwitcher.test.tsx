import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import QuickSwitcher from './QuickSwitcher'
import { jsonResponse, stubFetch } from './testUtils'

const onClose = vi.fn()
const onSelect = vi.fn()

const hits = [
  { id: 'n1', title: 'Raft consensus', icon: '📘', snippet: 'leader election' },
  { id: 'n2', title: 'Paxos', icon: null, snippet: '' },
  { id: 'n3', title: 'Gossip', icon: null, snippet: 'epidemic' },
]

const ui = (open = true) => (
  <QuickSwitcher spaceId="s1" open={open} onClose={onClose} onSelect={onSelect} />
)
const box = () => screen.getByRole('combobox', { name: 'Search pages' })
const type = (value: string) => fireEvent.change(box(), { target: { value } })
const flush = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  onClose.mockReset()
  onSelect.mockReset()
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('QuickSwitcher', () => {
  it('renders nothing while closed', () => {
    render(ui(false))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens focused on the search box with a hint when there is no history', () => {
    render(ui())
    expect(screen.getByRole('dialog', { name: 'Search pages' })).toHaveAttribute('aria-modal', 'true')
    expect(box()).toHaveFocus()
    expect(screen.getByText('Type to search your pages.')).toBeInTheDocument()
  })

  it('lists recent pages when the box is empty and selects one', () => {
    window.localStorage.setItem(
      'atlas.notes.recent.s1',
      JSON.stringify([
        { id: 'r1', title: 'Recent one', icon: null },
        { id: 'r2', title: 'Recent two', icon: '🔥' },
      ])
    )
    render(ui())
    expect(screen.getByText('Recent')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: /Recent two/ }))
    expect(onSelect).toHaveBeenCalledWith('r2')
    expect(onClose).toHaveBeenCalled()
  })

  it('debounces: no request until typing pauses, then exactly one for the final text', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, { items: hits }))
    render(ui())
    type('r')
    await flush(100)
    type('ra')
    await flush(100)
    type('raft')
    await flush(150)
    expect(calls).toHaveLength(0)
    await flush(100)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('/api/spaces/s1/notes/search?q=raft')
    await flush(0)
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(screen.getByText('leader election')).toBeInTheDocument()
  })

  it('arrow keys move the highlight (wrapping) and Enter opens the page', async () => {
    stubFetch(() => jsonResponse(200, { items: hits }))
    render(ui())
    type('a')
    await flush(250)
    const options = () => screen.getAllByRole('option')
    expect(options()[0]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    expect(options()[1]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    fireEvent.keyDown(box(), { key: 'ArrowDown' }) // wraps to first
    expect(options()[0]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(box(), { key: 'ArrowUp' }) // wraps to last
    expect(options()[2]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('n3')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Enter with no results does nothing', async () => {
    stubFetch(() => jsonResponse(200, { items: [] }))
    render(ui())
    type('zzz')
    await flush(250)
    expect(screen.getByText(/No pages match/)).toBeInTheDocument()
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('Escape closes the dialog', () => {
    render(ui())
    fireEvent.keyDown(box(), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('clicking the backdrop closes, clicking inside does not', () => {
    render(ui())
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('traps focus: Tab and Shift+Tab stay inside the dialog', async () => {
    window.localStorage.setItem(
      'atlas.notes.recent.s1',
      JSON.stringify([{ id: 'r1', title: 'Recent one', icon: null }])
    )
    render(
      <>
        <button>outside</button>
        {ui()}
      </>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    // Only the input is tabbable inside; Tab from it wraps to itself, never outside.
    fireEvent.keyDown(box(), { key: 'Tab' })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    fireEvent.keyDown(box(), { key: 'Tab', shiftKey: true })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    // Focus that escaped (e.g. clicked outside) is pulled back on the next Tab.
    screen.getByText('outside').focus()
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  it('returns focus to the opener when it closes', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { rerender } = render(ui())
    expect(box()).toHaveFocus()
    rerender(ui(false))
    expect(opener).toHaveFocus()
    opener.remove()
  })

  it('shows an error when the search fails, and ignores a superseded slow response', async () => {
    let resolveSlow: (r: Response) => void = () => {}
    const slow = new Promise<Response>(resolve => (resolveSlow = resolve))
    let n = 0
    stubFetch(() => (n++ === 0 ? slow : jsonResponse(500, { error: { code: 'x', message: 'down' } })))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(ui())
    type('first')
    await flush(250)
    type('second')
    await flush(250)
    await flush(0)
    expect(screen.getByRole('alert')).toHaveTextContent('Search failed')
    resolveSlow(jsonResponse(200, { items: hits }))
    await flush(10)
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('clearing the box goes back to recent pages', async () => {
    window.localStorage.setItem(
      'atlas.notes.recent.s1',
      JSON.stringify([{ id: 'r1', title: 'Recent one', icon: null }])
    )
    stubFetch(() => jsonResponse(200, { items: hits }))
    render(ui())
    type('raft')
    await flush(250)
    expect(screen.getByText('Raft consensus')).toBeInTheDocument()
    type('')
    expect(screen.getByText('Recent one')).toBeInTheDocument()
    expect(screen.queryByText('Raft consensus')).not.toBeInTheDocument()
  })
})
