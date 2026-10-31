'use client'

/** Toolbar button + portaled emoji panel, positioned by `computeEmojiPanelPosition`. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import dashboardStyles from '@/components/dashboard/dashboard.module.css'
import {
  EMOJIS,
  EMOJI_PANEL_WIDTH,
  computeEmojiPanelPosition,
  type EmojiPanelPosition,
} from '@/lib/notes/editor-utils'

interface NoteEmojiButtonProps {
  disabled: boolean
  onPick: (emoji: string) => void
}

export default function NoteEmojiButton({ disabled, onPick }: NoteEmojiButtonProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<EmojiPanelPosition | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node
      if (wrapRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const reposition = () => {
      const anchor = buttonRef.current
      if (!anchor) return
      const panel = panelRef.current
      setPos(
        computeEmojiPanelPosition(anchor.getBoundingClientRect(), {
          width: panel?.offsetWidth ?? EMOJI_PANEL_WIDTH,
          height: panel?.offsetHeight ?? 0,
        })
      )
    }
    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
      setPos(null)
    }
  }, [open])

  return (
    <div className={dashboardStyles.notesEmojiWrap} ref={wrapRef}>
      <button
        type="button"
        ref={buttonRef}
        className={dashboardStyles.notesTool}
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        aria-label="Add emoji"
        aria-expanded={open}
      >
        Emoji
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              className={dashboardStyles.notesEmojiPanel}
              role="listbox"
              aria-label="Emojis"
              style={{
                top: pos?.top ?? 0,
                left: pos?.left ?? 0,
                opacity: pos ? 1 : 0,
                pointerEvents: pos ? 'auto' : 'none',
              }}
            >
              {EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  className={dashboardStyles.notesEmojiBtn}
                  onClick={() => {
                    onPick(emoji)
                    setOpen(false)
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
