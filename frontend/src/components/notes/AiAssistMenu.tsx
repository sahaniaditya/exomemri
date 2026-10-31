'use client'

/**
 * User-triggered AI assist for a note. Nothing is written to the document until
 * the user accepts a result in the preview card (Insert below / Replace selection).
 *
 * Opens from the selection buttons below, or from the slash menu via AI_ASSIST_EVENT.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Editor } from '@tiptap/react'

import {
  AI_ASSIST_EVENT,
  ASSIST_LABEL,
  requestAssist,
  singleParagraphInline,
  textToParagraphs,
  type AssistAction,
  type AssistErrorKind,
} from '@/lib/notes/aiAssist'
import { resolveAssistTarget, type AssistTarget } from '@/lib/notes/assistInput'
import styles from './notes-intelligence.module.css'

type Phase =
  | { kind: 'idle' }
  | { kind: 'asking'; target: AssistTarget }
  | { kind: 'working' }
  | { kind: 'result'; text: string; job: Job }
  | { kind: 'error'; errorKind: AssistErrorKind; message: string; job: Job | null }

interface Job {
  action: AssistAction
  instruction?: string
  target: AssistTarget
}

const SELECTION_ACTIONS: AssistAction[] = ['summarize', 'rewrite', 'expand', 'ask']
const EMPTY_MESSAGE = 'Nothing to work on yet. Write something or select some text first.'

export default function AiAssistMenu({
  editor,
  spaceId,
  noteId,
}: {
  editor: Editor | null
  spaceId: string
  noteId?: string
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [hasSelection, setHasSelection] = useState(false)
  const [question, setQuestion] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!editor) return
    const update = () => setHasSelection(!editor.state.selection.empty)
    update()
    editor.on('selectionUpdate', update)
    return () => {
      editor.off('selectionUpdate', update)
    }
  }, [editor])

  const run = useCallback(
    async (job: Job) => {
      const controller = new AbortController()
      abortRef.current = controller
      setPhase({ kind: 'working' })
      const result = await requestAssist(
        spaceId,
        { action: job.action, text: job.target.text, instruction: job.instruction, noteId },
        controller.signal
      )
      if (controller.signal.aborted) return
      if (result.ok) setPhase({ kind: 'result', text: result.text, job })
      else if (result.kind !== 'aborted') {
        setPhase({ kind: 'error', errorKind: result.kind, message: result.message, job })
      }
    },
    [spaceId, noteId]
  )

  const start = useCallback(
    (action: AssistAction) => {
      if (!editor) return
      const target = resolveAssistTarget(editor, action)
      if (!target.text) {
        setPhase({ kind: 'error', errorKind: 'server', message: EMPTY_MESSAGE, job: null })
        return
      }
      if (action === 'ask') {
        setQuestion('')
        setPhase({ kind: 'asking', target })
        return
      }
      void run({ action, target })
    },
    [editor, run]
  )

  useEffect(() => {
    function onRequest(event: Event) {
      const action = (event as CustomEvent<{ action?: AssistAction }>).detail?.action
      if (action) start(action)
    }
    window.addEventListener(AI_ASSIST_EVENT, onRequest)
    return () => window.removeEventListener(AI_ASSIST_EVENT, onRequest)
  }, [start])

  useEffect(() => () => abortRef.current?.abort(), [])

  function close() {
    abortRef.current?.abort()
    setPhase({ kind: 'idle' })
  }

  function insertBelow(text: string, job: Job) {
    if (!editor) return
    const at = Math.min(job.target.insertAt, editor.state.doc.content.size)
    editor.chain().focus().insertContentAt(at, textToParagraphs(text)).run()
    close()
  }

  function replaceSelection(text: string, job: Job) {
    const selection = job.target.selection
    if (!editor || !selection) return
    const size = editor.state.doc.content.size
    const range = { from: Math.min(selection.from, size), to: Math.min(selection.to, size) }
    const inline = singleParagraphInline(text)
    editor
      .chain()
      .focus()
      .insertContentAt(range, inline ?? textToParagraphs(text))
      .run()
    close()
  }

  function submitQuestion(event: React.FormEvent) {
    event.preventDefault()
    const instruction = question.trim()
    if (phase.kind !== 'asking' || !instruction) return
    void run({ action: 'ask', instruction, target: phase.target })
  }

  return (
    <div className={styles.aiRoot}>
      {phase.kind === 'idle' && hasSelection && (
        <div className={styles.aiBar} role="toolbar" aria-label="AI assist">
          <span className={styles.aiBarLabel}>AI</span>
          {SELECTION_ACTIONS.map(action => (
            <button
              key={action}
              type="button"
              className={styles.ghostButton}
              onMouseDown={event => event.preventDefault()}
              onClick={() => start(action)}
            >
              {ASSIST_LABEL[action]}
            </button>
          ))}
        </div>
      )}

      {phase.kind === 'asking' && (
        <form className={styles.aiCard} onSubmit={submitQuestion}>
          <label htmlFor="ai-assist-question" className={styles.aiCardLabel}>
            What do you want to ask?
          </label>
          <input
            id="ai-assist-question"
            className={styles.aiInput}
            value={question}
            maxLength={500}
            autoFocus
            onChange={event => setQuestion(event.target.value)}
          />
          <div className={styles.aiActions}>
            <button type="submit" className={styles.primaryButton} disabled={!question.trim()}>
              Ask
            </button>
            <button type="button" className={styles.ghostButton} onClick={close}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {phase.kind === 'working' && (
        <div className={styles.aiCard} role="status">
          <p className={styles.status}>Working on it…</p>
          <div className={styles.aiActions}>
            <button type="button" className={styles.ghostButton} onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase.kind === 'result' && (
        <div className={styles.aiCard} aria-label="AI result">
          <p className={styles.aiResult}>{phase.text}</p>
          <div className={styles.aiActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => insertBelow(phase.text, phase.job)}
            >
              Insert below
            </button>
            {phase.job.target.selection && (
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => replaceSelection(phase.text, phase.job)}
              >
                Replace selection
              </button>
            )}
            <button type="button" className={styles.ghostButton} onClick={close}>
              Discard
            </button>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => void run(phase.job)}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {phase.kind === 'error' && (
        <div className={styles.aiCard} role="alert">
          <p className={styles.statusError}>{phase.message}</p>
          {phase.errorKind === 'credits' && (
            <p className={styles.status}>
              <Link href="/dashboard">See your credits</Link>
            </p>
          )}
          <div className={styles.aiActions}>
            {phase.errorKind !== 'credits' && phase.job && (
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => phase.job && void run(phase.job)}
              >
                Try again
              </button>
            )}
            <button type="button" className={styles.ghostButton} onClick={close}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
