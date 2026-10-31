/**
 * Block handle: a hover "drag handle" (⋮⋮) for top-level blocks, drag-to-reorder with a drop
 * indicator, a click that asks the page to open the block menu, and Alt+ArrowUp/Down to move
 * the current block. Built as our own ProseMirror plugin (see handoff: the official
 * `@tiptap/extension-drag-handle` is MIT but needs collaboration peers, and we need the menu
 * and pure block operations anyway).
 *
 * All structural changes go through the pure functions in `@/lib/notes/blockOps` and are applied
 * as a single transaction replacing only the affected top-level range (so undo is one step).
 */
import { Extension, type JSONContent } from '@tiptap/core'
import { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, Selection, type EditorState, type Transaction } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import {
  deleteBlock,
  dropSlotForY,
  duplicateBlock,
  moveBlock,
  slotToTargetIndex,
  turnInto,
  type TurnIntoTarget,
} from '@/lib/notes/blockOps'

export const BLOCK_MENU_EVENT = 'note:block-menu'

export interface BlockMenuEventDetail {
  index: number
  rect: { left: number; top: number; bottom: number }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockHandle: {
      moveBlockTo: (fromIndex: number, toIndex: number) => ReturnType
      /** Move the block holding the cursor up (-1) or down (+1). */
      moveCurrentBlock: (direction: -1 | 1) => ReturnType
      duplicateBlockAt: (index: number) => ReturnType
      deleteBlockAt: (index: number) => ReturnType
      turnBlockInto: (index: number, target: TurnIntoTarget) => ReturnType
      /** Turn the block (or, for plain text blocks, the text block) holding the cursor into `target`. */
      turnSelectionInto: (target: TurnIntoTarget) => ReturnType
    }
  }
}

/** Start/end positions of each top-level child. */
function topLevelRanges(doc: PMNode): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  doc.forEach((node, offset) => out.push({ start: offset, end: offset + node.nodeSize }))
  return out
}

export function currentBlockIndex(state: EditorState): number {
  return state.selection.$from.index(0)
}

/**
 * Replace the top-level blocks `fromIdx..toIdx` (inclusive) with `blocks`, then put the caret in
 * the block at `caretIdx` (an index in the new document).
 */
function replaceRange(
  tr: Transaction,
  fromIdx: number,
  toIdx: number,
  blocks: JSONContent[],
  caretIdx: number,
): void {
  const ranges = topLevelRanges(tr.doc)
  const nodes = blocks.map((b) => PMNode.fromJSON(tr.doc.type.schema, b))
  tr.replaceWith(ranges[fromIdx].start, ranges[toIdx].end, nodes)
  let pos = 0
  tr.doc.forEach((_node, offset, i) => {
    if (i === caretIdx) pos = offset
  })
  tr.setSelection(Selection.near(tr.doc.resolve(pos + 1)))
}

const docJSON = (state: EditorState) => state.doc.toJSON() as JSONContent

export const BlockHandle = Extension.create({
  name: 'blockHandle',

  addCommands() {
    return {
      moveBlockTo:
        (from, to) =>
        ({ state, tr, dispatch }) => {
          const n = state.doc.childCount
          if (from === to || from < 0 || to < 0 || from >= n || to >= n) return false
          if (dispatch) {
            const lo = Math.min(from, to)
            const hi = Math.max(from, to)
            const next = moveBlock(docJSON(state), from, to)
            replaceRange(tr, lo, hi, (next.content ?? []).slice(lo, hi + 1), to)
          }
          return true
        },
      moveCurrentBlock:
        (direction) =>
        ({ state, commands }) => {
          const from = currentBlockIndex(state)
          const to = from + direction
          if (to < 0 || to >= state.doc.childCount) return false
          return commands.moveBlockTo(from, to)
        },
      duplicateBlockAt:
        (index) =>
        ({ state, tr, dispatch }) => {
          if (index < 0 || index >= state.doc.childCount) return false
          if (dispatch) {
            const next = duplicateBlock(docJSON(state), index)
            replaceRange(tr, index, index, (next.content ?? []).slice(index, index + 2), index + 1)
          }
          return true
        },
      deleteBlockAt:
        (index) =>
        ({ state, tr, dispatch }) => {
          if (index < 0 || index >= state.doc.childCount) return false
          if (dispatch) {
            // Deleting the only block leaves one empty paragraph in its place.
            const only = state.doc.childCount === 1
            const next = deleteBlock(docJSON(state), index)
            const caret = Math.min(index, (next.content ?? []).length - 1)
            replaceRange(tr, index, index, only ? (next.content ?? []) : [], caret)
          }
          return true
        },
      turnBlockInto:
        (index, target) =>
        ({ state, tr, dispatch }) => {
          if (index < 0 || index >= state.doc.childCount) return false
          const block = docJSON(state).content![index]
          const replacement = turnInto(block, target)
          if (dispatch) replaceRange(tr, index, index, replacement, index)
          return true
        },
      turnSelectionInto:
        (target) =>
        ({ state, commands }) => {
          const { $from } = state.selection
          // Text nested in a callout/quote/table cell is retyped in place when the schema allows it;
          // otherwise (list items, toggle summaries, top level) the whole top-level block is converted.
          const nestedText = $from.parent.isTextblock && $from.depth > 1
          if (nestedText && target === 'paragraph' && commands.setNode('paragraph')) return true
          if (
            nestedText &&
            target.startsWith('heading') &&
            commands.setNode('heading', { level: Number(target.slice(-1)) })
          ) {
            return true
          }
          return commands.turnBlockInto(currentBlockIndex(state), target)
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Alt-ArrowUp': ({ editor }) => editor.commands.moveCurrentBlock(-1),
      'Alt-ArrowDown': ({ editor }) => editor.commands.moveCurrentBlock(1),
    }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    return [createHandlePlugin(editor.commands.moveBlockTo.bind(editor.commands))]
  },
})

const handleKey = new PluginKey('noteBlockHandle')

function createHandlePlugin(moveTo: (from: number, to: number) => boolean) {
  return new Plugin({
    key: handleKey,
    view(view) {
      if (typeof document === 'undefined') return {}
      return new HandleView(view, moveTo)
    },
  })
}

class HandleView {
  private handle: HTMLButtonElement
  private indicator: HTMLDivElement
  private hoverIndex = -1
  private dragIndex = -1
  private slot = -1
  private readonly listeners: Array<() => void> = []

  constructor(
    private view: EditorView,
    private moveTo: (from: number, to: number) => boolean,
  ) {
    this.handle = document.createElement('button')
    this.handle.type = 'button'
    this.handle.className = 'note-block-handle'
    this.handle.draggable = true
    this.handle.textContent = '⋮⋮'
    this.handle.setAttribute('aria-label', 'Drag to move, click for block menu')
    this.handle.style.display = 'none'
    this.indicator = document.createElement('div')
    this.indicator.className = 'note-drop-indicator'
    this.indicator.style.display = 'none'
    document.body.append(this.handle, this.indicator)

    const on = <K extends keyof HTMLElementEventMap>(
      el: HTMLElement,
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
    ) => {
      el.addEventListener(type, fn as EventListener)
      this.listeners.push(() => el.removeEventListener(type, fn as EventListener))
    }
    const dom = view.dom as HTMLElement
    on(dom, 'mousemove', (e) => this.onMouseMove(e))
    on(dom, 'mouseleave', (e) => {
      if (e.relatedTarget !== this.handle) this.hide()
    })
    on(this.handle, 'mouseleave', (e) => {
      if (!dom.contains(e.relatedTarget as Node | null)) this.hide()
    })
    on(this.handle, 'click', () => this.openMenu())
    on(this.handle, 'dragstart', (e) => this.onDragStart(e))
    on(this.handle, 'dragend', () => this.endDrag())
    on(dom, 'dragover', (e) => this.onDragOver(e))
    on(dom, 'drop', (e) => this.onDrop(e))
    window.addEventListener('scroll', this.hideBound, true)
  }

  private hideBound = () => this.hide()

  private blockElement(index: number): HTMLElement | null {
    if (index < 0 || index >= this.view.state.doc.childCount) return null
    let found = 0
    this.view.state.doc.forEach((_node, offset, i) => {
      if (i === index) found = offset
    })
    const dom = this.view.nodeDOM(found)
    return dom instanceof HTMLElement ? dom : null
  }

  private blockRects() {
    const rects: { top: number; bottom: number }[] = []
    for (let i = 0; i < this.view.state.doc.childCount; i++) {
      const r = this.blockElement(i)?.getBoundingClientRect()
      rects.push({ top: r?.top ?? 0, bottom: r?.bottom ?? 0 })
    }
    return rects
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.view.editable) return this.hide()
    const rect = (this.view.dom as HTMLElement).getBoundingClientRect()
    const hit = this.view.posAtCoords({ left: Math.max(e.clientX, rect.left + 1), top: e.clientY })
    if (!hit) return this.hide()
    const index = this.view.state.doc.resolve(hit.pos).index(0)
    this.show(index)
  }

  private show(index: number) {
    const el = this.blockElement(index)
    if (!el) return this.hide()
    this.hoverIndex = index
    const r = el.getBoundingClientRect()
    this.handle.style.display = 'flex'
    this.handle.style.top = `${r.top + 2}px`
    this.handle.style.left = `${r.left - 28}px`
  }

  private hide() {
    if (this.dragIndex >= 0) return
    this.hoverIndex = -1
    this.handle.style.display = 'none'
  }

  private openMenu() {
    if (this.hoverIndex < 0) return
    const r = this.handle.getBoundingClientRect()
    const detail: BlockMenuEventDetail = {
      index: this.hoverIndex,
      rect: { left: r.left, top: r.top, bottom: r.bottom },
    }
    this.view.dom.dispatchEvent(new CustomEvent(BLOCK_MENU_EVENT, { bubbles: true, detail }))
  }

  private onDragStart(e: DragEvent) {
    if (this.hoverIndex < 0 || !e.dataTransfer) return e.preventDefault()
    this.dragIndex = this.hoverIndex
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', ' ')
    const el = this.blockElement(this.dragIndex)
    if (el) e.dataTransfer.setDragImage(el, 0, 0)
  }

  private onDragOver(e: DragEvent) {
    if (this.dragIndex < 0) return
    e.preventDefault()
    const rects = this.blockRects()
    this.slot = dropSlotForY(rects, e.clientY)
    const dom = (this.view.dom as HTMLElement).getBoundingClientRect()
    const y = this.slot >= rects.length ? rects[rects.length - 1].bottom : rects[this.slot].top
    this.indicator.style.display = 'block'
    this.indicator.style.top = `${y - 1}px`
    this.indicator.style.left = `${dom.left}px`
    this.indicator.style.width = `${dom.width}px`
  }

  private onDrop(e: DragEvent) {
    if (this.dragIndex < 0) return
    e.preventDefault()
    e.stopPropagation()
    const from = this.dragIndex
    const to = slotToTargetIndex(from, this.slot < 0 ? from : this.slot)
    this.endDrag()
    if (to !== from) this.moveTo(from, to)
  }

  private endDrag() {
    this.dragIndex = -1
    this.slot = -1
    this.indicator.style.display = 'none'
    this.handle.style.display = 'none'
  }

  update() {
    // Block positions shift on any change; drop the stale handle until the next hover.
    if (this.dragIndex < 0) this.hide()
  }

  destroy() {
    this.listeners.forEach((off) => off())
    window.removeEventListener('scroll', this.hideBound, true)
    this.handle.remove()
    this.indicator.remove()
  }
}
