'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { TURN_INTO_OPTIONS } from '@/lib/notes/turnIntoOptions'
import { BLOCK_MENU_EVENT, type BlockMenuEventDetail } from './extensions/blockHandle'
import { useDismiss } from './hooks/useDismiss'
import styles from './note-blocks.module.css'

/** Menu opened by clicking a block's ⋮⋮ handle: Turn into, Duplicate, Delete, Move up/down. */
export default function BlockHandleMenu({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState<BlockMenuEventDetail | null>(null)
  const [turnInto, setTurnInto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setOpen(null)
    setTurnInto(false)
  }, [])
  useDismiss(ref, open !== null, close)

  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const onOpen = (e: Event) => setOpen((e as CustomEvent<BlockMenuEventDetail>).detail)
    dom.addEventListener(BLOCK_MENU_EVENT, onOpen)
    return () => dom.removeEventListener(BLOCK_MENU_EVENT, onOpen)
  }, [editor])

  if (!editor || !open) return null

  const { index } = open
  const count = editor.state.doc.childCount
  const act = (fn: () => void) => {
    fn()
    close()
  }

  return (
    <div
      ref={ref}
      className={`${styles.popover} ${styles.floating}`}
      style={{ left: open.rect.left, top: open.rect.bottom + 4 }}
      role="menu"
      aria-label="Block menu"
    >
      {turnInto ? (
        <>
          <button type="button" role="menuitem" className={styles.item} onClick={() => setTurnInto(false)}>
            <span className={styles.itemIcon} aria-hidden="true">←</span>
            Back
          </button>
          {TURN_INTO_OPTIONS.map((o) => (
            <button
              key={o.target}
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => act(() => editor.chain().focus().turnBlockInto(index, o.target).run())}
            >
              <span className={styles.itemIcon} aria-hidden="true">{o.icon}</span>
              {o.label}
            </button>
          ))}
        </>
      ) : (
        <>
          <button type="button" role="menuitem" className={styles.item} onClick={() => setTurnInto(true)}>
            <span className={styles.itemIcon} aria-hidden="true">↻</span>
            Turn into
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => act(() => editor.chain().focus().duplicateBlockAt(index).run())}
          >
            <span className={styles.itemIcon} aria-hidden="true">⧉</span>
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            disabled={index <= 0}
            onClick={() => act(() => editor.chain().focus().moveBlockTo(index, index - 1).run())}
          >
            <span className={styles.itemIcon} aria-hidden="true">↑</span>
            Move up
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            disabled={index >= count - 1}
            onClick={() => act(() => editor.chain().focus().moveBlockTo(index, index + 1).run())}
          >
            <span className={styles.itemIcon} aria-hidden="true">↓</span>
            Move down
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${styles.item} ${styles.itemDanger}`}
            onClick={() => act(() => editor.chain().focus().deleteBlockAt(index).run())}
          >
            <span className={styles.itemIcon} aria-hidden="true">🗑</span>
            Delete
          </button>
        </>
      )}
    </div>
  )
}
