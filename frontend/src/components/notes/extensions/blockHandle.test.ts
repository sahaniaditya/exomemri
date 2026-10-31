import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/core'
import '@/test/layoutStubs'
import { createEditor, doc, getDoc, p } from '@/test/noteEditor'
import { BLOCK_MENU_EVENT, type BlockMenuEventDetail } from './blockHandle'

let editor: Editor
afterEach(() => editor?.destroy())

const order = () => getDoc(editor).content!.map((n) => n.content?.[0]?.text)
const handle = () => document.querySelector('.note-block-handle') as HTMLButtonElement
const indicator = () => document.querySelector('.note-drop-indicator') as HTMLDivElement

/** Four 20px-high blocks stacked from y=0, with jsdom's missing layout and hit-testing stubbed. */
function setup() {
  editor = createEditor(doc(p('a'), p('b'), p('c'), p('d')))
  const kids = Array.from(editor.view.dom.children) as HTMLElement[]
  kids.forEach((el, i) => {
    el.getBoundingClientRect = () => new DOMRect(40, i * 20, 400, 20)
  })
  editor.view.dom.getBoundingClientRect = () => new DOMRect(40, 0, 400, 80)
  // The block under the pointer is chosen by y; map y to a position inside that block.
  editor.view.posAtCoords = ({ top }) => {
    const index = Math.min(3, Math.max(0, Math.floor(top / 20)))
    let pos = 0
    editor.state.doc.forEach((_n, offset, i) => {
      if (i === index) pos = offset + 1
    })
    return { pos, inside: pos }
  }
}

const hover = (y: number) =>
  editor.view.dom.dispatchEvent(new MouseEvent('mousemove', { clientX: 60, clientY: y, bubbles: true }))

function dragEvent(type: string, clientY = 0) {
  const e = new Event(type, { bubbles: true, cancelable: true }) as DragEvent
  Object.assign(e, {
    clientY,
    dataTransfer: { effectAllowed: '', setData: vi.fn(), setDragImage: vi.fn() },
  })
  return e
}

describe('block handle (hover, menu, drag)', () => {
  it('stays hidden until a block is hovered, then sits next to that block', () => {
    setup()
    expect(handle().style.display).toBe('none')
    hover(30)
    expect(handle().style.display).toBe('flex')
    expect(handle().style.top).toBe('22px')
    expect(handle().style.left).toBe('12px')
    hover(70)
    expect(handle().style.top).toBe('62px')
  })

  it('hides when the pointer leaves the editor and when the editor is read-only', () => {
    setup()
    hover(10)
    editor.view.dom.dispatchEvent(new MouseEvent('mouseleave', { relatedTarget: document.body }))
    expect(handle().style.display).toBe('none')
    editor.setEditable(false)
    hover(10)
    expect(handle().style.display).toBe('none')
  })

  it('clicking the handle asks the page to open the block menu for the hovered block', () => {
    setup()
    const seen: BlockMenuEventDetail[] = []
    editor.view.dom.addEventListener(BLOCK_MENU_EVENT, (e) =>
      seen.push((e as CustomEvent<BlockMenuEventDetail>).detail),
    )
    hover(50)
    handle().click()
    expect(seen).toHaveLength(1)
    expect(seen[0].index).toBe(2)
  })

  it('dragging a block to a lower slot reorders it, shows an indicator, and undo restores', () => {
    setup()
    hover(10) // block a
    handle().dispatchEvent(dragEvent('dragstart'))
    // y=55 is past the midpoint of "c" (50) -> slot after c -> target index 2.
    editor.view.dom.dispatchEvent(dragEvent('dragover', 55))
    expect(indicator().style.display).toBe('block')
    expect(indicator().style.top).toBe('59px') // bottom of block c (60) minus 1
    editor.view.dom.dispatchEvent(dragEvent('drop', 55))
    expect(order()).toEqual(['b', 'c', 'a', 'd'])
    expect(indicator().style.display).toBe('none')
    editor.commands.undo()
    expect(order()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('dragging to the end and to the very top', () => {
    setup()
    hover(10)
    handle().dispatchEvent(dragEvent('dragstart'))
    editor.view.dom.dispatchEvent(dragEvent('dragover', 500))
    editor.view.dom.dispatchEvent(dragEvent('drop', 500))
    expect(order()).toEqual(['b', 'c', 'd', 'a'])

    // Fresh drag of "d" (index 2 now) above everything.
    hover(50)
    handle().dispatchEvent(dragEvent('dragstart'))
    editor.view.dom.dispatchEvent(dragEvent('dragover', -5))
    editor.view.dom.dispatchEvent(dragEvent('drop', -5))
    expect(order()).toEqual(['d', 'b', 'c', 'a'])
  })

  it('dropping back onto the same position changes nothing', () => {
    setup()
    hover(30) // block b
    handle().dispatchEvent(dragEvent('dragstart'))
    editor.view.dom.dispatchEvent(dragEvent('dragover', 25)) // slot 1 = before b
    editor.view.dom.dispatchEvent(dragEvent('drop', 25))
    expect(order()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('dragend without a drop cancels cleanly', () => {
    setup()
    hover(10)
    handle().dispatchEvent(dragEvent('dragstart'))
    editor.view.dom.dispatchEvent(dragEvent('dragover', 55))
    handle().dispatchEvent(dragEvent('dragend'))
    expect(indicator().style.display).toBe('none')
    expect(order()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('ignores dragover that did not start from the handle', () => {
    setup()
    // Dispatched on the host so third-party drop-cursor code (needs real layout) is not involved.
    const over = dragEvent('dragover', 55)
    editor.view.dom.parentElement!.dispatchEvent(over)
    expect(over.defaultPrevented).toBe(false)
    expect(indicator().style.display).toBe('none')
  })

  it('while our drag is active ProseMirror does not also handle the drop', () => {
    setup()
    hover(10)
    handle().dispatchEvent(dragEvent('dragstart'))
    const seen = vi.fn()
    // A bubble-phase listener on the editor DOM stands in for ProseMirror's own drop handler.
    editor.view.dom.addEventListener('drop', seen)
    editor.view.dom.dispatchEvent(dragEvent('drop', 55))
    expect(seen).not.toHaveBeenCalled()
    expect(editor.state.doc.textContent).toBe('abcd')
  })

  it('cleans up its elements on destroy', () => {
    setup()
    editor.destroy()
    expect(handle()).toBeNull()
    expect(indicator()).toBeNull()
  })
})
