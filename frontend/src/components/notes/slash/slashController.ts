import type { SlashItem } from './types'

export interface SlashMenuState {
  open: boolean
  query: string
  items: SlashItem[]
  selectedIndex: number
  /** Caret rectangle supplied by the suggestion plugin (viewport coordinates). */
  rect: (() => DOMRect | null) | null
}

const CLOSED: SlashMenuState = {
  open: false,
  query: '',
  items: [],
  selectedIndex: 0,
  rect: null,
}

interface SlashSession {
  query: string
  items: SlashItem[]
  rect: (() => DOMRect | null) | null
  command: (item: SlashItem) => void
}

/**
 * Framework-free store bridging the ProseMirror suggestion plugin and the React
 * `SlashMenu`. One instance lives in the editor's extension storage.
 */
export class SlashController {
  private state: SlashMenuState = CLOSED
  private listeners = new Set<() => void>()
  private runCommand: ((item: SlashItem) => void) | null = null

  getState = (): SlashMenuState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  open(session: SlashSession): void {
    this.runCommand = session.command
    this.set({
      open: true,
      query: session.query,
      items: session.items,
      selectedIndex: 0,
      rect: session.rect,
    })
  }

  update(session: SlashSession): void {
    this.runCommand = session.command
    const queryChanged = session.query !== this.state.query
    this.set({
      open: true,
      query: session.query,
      items: session.items,
      selectedIndex: queryChanged
        ? 0
        : Math.min(this.state.selectedIndex, Math.max(0, session.items.length - 1)),
      rect: session.rect,
    })
  }

  close(): void {
    this.runCommand = null
    if (this.state !== CLOSED) this.set(CLOSED)
  }

  move(delta: 1 | -1): void {
    const { items, selectedIndex } = this.state
    if (!items.length) return
    this.set({
      ...this.state,
      selectedIndex: (selectedIndex + delta + items.length) % items.length,
    })
  }

  hover(index: number): void {
    if (index !== this.state.selectedIndex) this.set({ ...this.state, selectedIndex: index })
  }

  select(item?: SlashItem): void {
    const target = item ?? this.state.items[this.state.selectedIndex]
    if (target && this.runCommand) this.runCommand(target)
  }

  /** Returns true when the key was consumed by the open menu. */
  handleKey(key: string): boolean {
    if (!this.state.open) return false
    switch (key) {
      case 'ArrowDown':
        this.move(1)
        return true
      case 'ArrowUp':
        this.move(-1)
        return true
      case 'Enter':
      case 'Tab':
        if (!this.state.items.length) return false
        this.select()
        return true
      case 'Escape':
        this.close()
        return true
      default:
        return false
    }
  }

  private set(next: SlashMenuState): void {
    this.state = next
    this.listeners.forEach(listener => listener())
  }
}
