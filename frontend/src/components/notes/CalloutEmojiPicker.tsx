'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { CALLOUT_EMOJIS, CALLOUT_VARIANTS, type CalloutVariant } from '@/lib/notes/palette'
import { CALLOUT_EMOJI_EVENT } from './extensions/callout'
import { useDismiss } from './hooks/useDismiss'
import styles from './note-blocks.module.css'

const VARIANT_LABEL: Record<CalloutVariant, string> = {
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  danger: 'Danger',
}

interface Open {
  pos: number
  left: number
  top: number
}

/**
 * Popover opened by clicking a callout's emoji (the node view fires CALLOUT_EMOJI_EVENT on the
 * editor DOM). Picks the emoji and the variant of that callout.
 */
export default function CalloutEmojiPicker({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState<Open | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(null), [])
  useDismiss(ref, open !== null, close)

  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const onOpen = (e: Event) => {
      const { pos } = (e as CustomEvent<{ pos: number }>).detail
      const el = editor.view.nodeDOM(pos)
      const rect = el instanceof HTMLElement ? el.getBoundingClientRect() : null
      setOpen({ pos, left: rect?.left ?? 0, top: (rect?.top ?? 0) + 36 })
    }
    dom.addEventListener(CALLOUT_EMOJI_EVENT, onOpen)
    return () => dom.removeEventListener(CALLOUT_EMOJI_EVENT, onOpen)
  }, [editor])

  if (!editor || !open) return null

  const current = editor.state.doc.nodeAt(open.pos)
  const currentEmoji = current?.attrs.emoji as string | undefined
  const currentVariant = current?.attrs.variant as CalloutVariant | undefined

  return (
    <div
      ref={ref}
      className={`${styles.popover} ${styles.floating}`}
      style={{ left: open.left, top: open.top }}
      role="dialog"
      aria-label="Callout emoji and style"
    >
      <div className={styles.emojiGrid}>
        {CALLOUT_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={styles.emoji}
            aria-label={`Use ${emoji}`}
            aria-pressed={emoji === currentEmoji}
            onClick={() => {
              editor.chain().setCalloutEmoji(emoji, open.pos).run()
              close()
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Callout style">
        {CALLOUT_VARIANTS.map((variant) => (
          <button
            key={variant}
            type="button"
            className={`${styles.item} ${variant === currentVariant ? styles.itemOn : ''}`}
            aria-pressed={variant === currentVariant}
            onClick={() => {
              editor.chain().setCalloutVariant(variant, open.pos).run()
              close()
            }}
          >
            <span
              className={styles.variantDot}
              style={{ ['--dot' as string]: `var(--note-callout-${variant})` }}
              aria-hidden="true"
            />
            {VARIANT_LABEL[variant]}
          </button>
        ))}
      </div>
    </div>
  )
}
