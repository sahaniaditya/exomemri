'use client'

/**
 * Popup for the `/` command menu, anchored at the caret. State comes from the
 * `SlashController` held in the editor's extension storage; keyboard handling lives
 * in the suggestion plugin so focus never leaves the editor.
 */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/core'
import styles from './notes.module.css'
import type { SlashController, SlashMenuState } from './slash/slashController'

const MENU_WIDTH = 288
const MENU_MAX_HEIGHT = 320
const VIEWPORT_MARGIN = 8
const CARET_GAP = 6

interface Position {
  top: number
  left: number
}

/** Clamp the menu into the viewport, flipping above the caret when there is no room below. */
export function computeSlashMenuPosition(
  caret: { top: number; bottom: number; left: number },
  menuHeight: number,
  viewport: { width: number; height: number }
): Position {
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(caret.left, viewport.width - MENU_WIDTH - VIEWPORT_MARGIN)
  )
  let top = caret.bottom + CARET_GAP
  if (top + menuHeight > viewport.height - VIEWPORT_MARGIN) {
    const above = caret.top - CARET_GAP - menuHeight
    if (above >= VIEWPORT_MARGIN) top = above
  }
  return { top: Math.max(VIEWPORT_MARGIN, top), left }
}

function controllerOf(editor: Editor | null): SlashController | null {
  const storage = editor?.storage as { slash?: { controller?: SlashController } } | undefined
  return storage?.slash?.controller ?? null
}

const NOOP_SUBSCRIBE = () => () => {}
const CLOSED_STATE: SlashMenuState = {
  open: false,
  query: '',
  items: [],
  selectedIndex: 0,
  rect: null,
}

export default function SlashMenu({ editor }: { editor: Editor | null }) {
  const controller = controllerOf(editor)
  const state = useSyncExternalStore(
    controller ? controller.subscribe : NOOP_SUBSCRIBE,
    controller ? controller.getState : () => CLOSED_STATE,
    () => CLOSED_STATE
  )
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position | null>(null)

  const { open, rect: caretRect, items, query } = state
  useLayoutEffect(() => {
    if (!open || !caretRect) return
    const rect = caretRect()
    if (!rect) return
    setPosition(
      computeSlashMenuPosition(
        { top: rect.top, bottom: rect.bottom, left: rect.left },
        menuRef.current?.offsetHeight ?? MENU_MAX_HEIGHT,
        { width: window.innerWidth, height: window.innerHeight }
      )
    )
  }, [open, caretRect, items, query])

  useEffect(() => {
    menuRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: 'nearest' })
  }, [state.selectedIndex, state.items])

  if (!state.open || !controller) return null
  const visiblePosition = position

  return createPortal(
    <div
      ref={menuRef}
      className={styles.slashMenu}
      role="listbox"
      aria-label="Insert block"
      style={{
        top: visiblePosition?.top ?? 0,
        left: visiblePosition?.left ?? 0,
        visibility: visiblePosition ? 'visible' : 'hidden',
      }}
      // Keep the caret in the editor while clicking the menu.
      onMouseDown={event => event.preventDefault()}
    >
      {state.items.length === 0 ? (
        <div className={styles.slashEmpty}>No results</div>
      ) : (
        state.items.map((item, index) => {
          const showGroup = index === 0 || state.items[index - 1].group !== item.group
          return (
            <div key={item.id}>
              {showGroup ? <div className={styles.slashGroup}>{item.group}</div> : null}
              <button
                type="button"
                role="option"
                aria-selected={index === state.selectedIndex}
                className={styles.slashItem}
                data-selected={index === state.selectedIndex ? 'true' : undefined}
                onMouseEnter={() => controller.hover(index)}
                onClick={() => controller.select(item)}
              >
                <span className={styles.slashIcon} aria-hidden="true">
                  {item.icon}
                </span>
                <span className={styles.slashText}>
                  <span className={styles.slashTitle}>{item.title}</span>
                  {item.description ? (
                    <span className={styles.slashDesc}>{item.description}</span>
                  ) : null}
                </span>
              </button>
            </div>
          )
        })
      )}
    </div>,
    document.body
  )
}
