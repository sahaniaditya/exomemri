'use client'
import { useEffect, useRef, useState } from 'react'
import styles from './dashboard.module.css'
import type { ChatMessage, SummaryResponse } from '@/lib/sources'

interface SourceChatProps {
  sourceId: string
  sourceTitle: string
  initialSummary: SummaryResponse | null
  initialMessages: ChatMessage[]
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export default function SourceChat({
  sourceId,
  sourceTitle,
  initialSummary,
  initialMessages,
}: SourceChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

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
    <div className={styles.chatwrap}>
      {initialSummary && (
        <div className={styles.summarycard}>
          <div className={styles.summarylabel}>Summary</div>
          <p className={styles.summarytext}>{initialSummary.summary}</p>
        </div>
      )}

      <div className={styles.chatlog}>
        {messages.length === 0 ? (
          <div className={styles.chatempty}>
            <p>Ask anything about &ldquo;{sourceTitle}&rdquo;.</p>
            <p className={styles.chatemptysub}>Answers are grounded in what was captured.</p>
          </div>
        ) : (
          messages.map(m => (
            <div
              key={m.id}
              className={`${styles.msgrow} ${m.role === 'user' ? styles.msgrowuser : styles.msgrowassistant}`}
            >
              {m.role === 'assistant' && <div className={styles.msgavatar}>AI</div>}
              <div className={styles.msgcol}>
                <div className={m.role === 'user' ? styles.bubbleuser : styles.bubbleassistant}>
                  {m.content}
                </div>
                <span className={styles.msgtime}>{formatTime(m.created_at)}</span>
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className={`${styles.msgrow} ${styles.msgrowassistant}`}>
            <div className={styles.msgavatar}>AI</div>
            <div className={styles.msgcol}>
              <div className={styles.bubbleassistant}>
                <span className={styles.typingdot} />
                <span className={styles.typingdot} />
                <span className={styles.typingdot} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className={styles.chatinputbar}>
        <textarea
          ref={textareaRef}
          className={styles.chatinput}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Ask a question about this source..."
          rows={1}
          disabled={sending}
        />
        <button
          type="button"
          className={styles.chatsend}
          onClick={handleSend}
          disabled={sending || !input.trim()}
          aria-label="Send message"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  )
}