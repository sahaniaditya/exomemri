'use client'

/**
 * Right-docked memory panel for a single capture.
 * Left-edge drag resizes width (extends into the page). Brand lockup + mark on send.
 */
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Lockup } from '@/components/brand/Lockup'
import { Mark } from '@/components/brand/Mark'
import styles from './dashboard.module.css'
import type { ChatMessage } from '@/lib/sources'

interface SourceChatPanelProps {
  sourceId: string
  sourceTitle: string
  initialMessages: ChatMessage[]
  onClose: () => void
}

const DEFAULT_WIDTH = 400
const MIN_WIDTH = 320
const MAX_WIDTH_RATIO = 0.72

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function maxWidth() {
  if (typeof window === 'undefined') return 720
  return Math.max(MIN_WIDTH, Math.floor(window.innerWidth * MAX_WIDTH_RATIO))
}

function clampWidth(width: number) {
  return Math.min(Math.max(MIN_WIDTH, width), maxWidth())
}

export default function SourceChatPanel({
  sourceId,
  sourceTitle,
  initialMessages,
  onClose,
}: SourceChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? DEFAULT_WIDTH : clampWidth(DEFAULT_WIDTH)
  )
  const [resizing, setResizing] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const resizingRef = useRef(false)
  const widthRef = useRef(width)

  useEffect(() => {
    widthRef.current = width
  }, [width])

  useEffect(() => {
    const onWindowResize = () => {
      const next = clampWidth(widthRef.current)
      widthRef.current = next
      setWidth(next)
      if (panelRef.current) panelRef.current.style.width = `${next}px`
    }
    window.addEventListener('resize', onWindowResize)
    return () => window.removeEventListener('resize', onWindowResize)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [input])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!resizing) return
    const prev = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = prev
      document.body.style.userSelect = prevSelect
    }
  }, [resizing])

  const onResizeStart = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    resizingRef.current = true
    setResizing(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onResizeMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resizingRef.current) return
    // Right-docked panel: drag left edge leftward to widen.
    const next = clampWidth(window.innerWidth - event.clientX)
    widthRef.current = next
    if (panelRef.current) panelRef.current.style.width = `${next}px`
  }

  const onResizeEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resizingRef.current) return
    resizingRef.current = false
    setResizing(false)
    setWidth(widthRef.current)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
  }

  const handleSend = async () => {
    const content = input.trim()
    if (!content || sending) return
    setInput('')
    setSending(true)

    const optimisticId = `pending-${Date.now()}`
    setMessages(prev => [
      ...prev,
      { id: optimisticId, role: 'user', content, created_at: new Date().toISOString() },
    ])

    try {
      const res = await fetch(`/api/sources/${sourceId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw Error(`status ${res.status}`)
      const data = (await res.json()) as {
        user_message: ChatMessage
        assistant_message: ChatMessage
      }
      setMessages(prev => [
        ...prev.filter(m => m.id !== optimisticId),
        data.user_message,
        data.assistant_message,
      ])
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      setInput(content)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.memoryOverlay} role="presentation">
      <button
        type="button"
        className={styles.memoryBackdrop}
        aria-label="Close memory panel"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        className={`${styles.memoryPanel} ${resizing ? styles.memoryPanelResizing : ''}`}
        aria-label="Ask this capture"
        style={{ width }}
      >
        <button
          type="button"
          className={styles.memoryResize}
          aria-label="Resize memory panel"
          title="Drag to resize"
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
        />

        <div className={styles.memoryPanelHead}>
          <div className={styles.memoryPanelBrand}>
            <div className={styles.memoryPanelEyebrow}>Ask your memory</div>
            <Lockup size={22} surface="#fbfaf6" />
          </div>
          <button
            type="button"
            className={styles.memoryPanelClose}
            onClick={onClose}
            aria-label="Close memory panel"
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className={styles.memoryCaptureChip} title={sourceTitle}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" aria-hidden="true">
            <path d="M6 5h12v14H6z" />
            <path d="M9 9h6M9 12h6M9 15h3.5" />
          </svg>
          <span>{sourceTitle}</span>
        </div>

        <div className={styles.memoryLog}>
          {messages.length === 0 && !sending ? (
            <div className={styles.memoryEmpty}>
              <div className={styles.memoryEmptyIcon} aria-hidden="true">
                <Mark size={22} surface="#f4f1e9" />
              </div>
              <p>Ask what this capture taught you.</p>
              <p className={styles.memoryEmptyHint}>
                Answers stay grounded in what you saved — not the open web.
              </p>
              <ul className={styles.memoryPrompts}>
                {[
                  'What are the main takeaways?',
                  'Explain the hardest idea simply.',
                  'What would an interviewer ask?',
                ].map(prompt => (
                  <li key={prompt}>
                    <button
                      type="button"
                      className={styles.memoryPrompt}
                      onClick={() => setInput(prompt)}
                    >
                      <span>{prompt}</span>
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            messages.map(m => (
              <div
                key={m.id}
                className={
                  m.role === 'user' ? styles.memoryTurnUser : styles.memoryTurnAssist
                }
              >
                <div className={styles.memoryTurnLabel}>
                  {m.role === 'user' ? 'You' : 'exomemri'}
                  <span>{formatTime(m.created_at)}</span>
                </div>
                <div className={styles.memoryTurnBody}>{m.content}</div>
              </div>
            ))
          )}
          {sending ? (
            <div className={styles.memoryTurnAssist}>
              <div className={styles.memoryTurnLabel}>exomemri</div>
              <div className={styles.memoryTurnBody}>
                <span className={styles.typingdot} />
                <span className={styles.typingdot} />
                <span className={styles.typingdot} />
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className={styles.memoryComposer}>
          <label className={styles.memoryComposerLabel} htmlFor={`ask-${sourceId}`}>
            Your question
          </label>
          <div className={styles.memoryComposerRow}>
            <textarea
              id={`ask-${sourceId}`}
              ref={textareaRef}
              className={styles.memoryInput}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSend()
                }
              }}
              placeholder="What should stick from this capture?"
              rows={1}
              disabled={sending}
            />
            <button
              type="button"
              className={styles.memorySend}
              onClick={() => void handleSend()}
              disabled={sending || !input.trim()}
              aria-label="Ask"
            >
              <Mark size={18} tone="reversed" surface="#2c5d4f" />
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
