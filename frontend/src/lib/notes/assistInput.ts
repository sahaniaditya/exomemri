/**
 * Decide what text an AI action runs on, and where its result may be written.
 * Pure over a minimal editor shape so it is unit-testable with a real TipTap editor.
 */
import type { Editor } from '@tiptap/react'

import { MAX_ASSIST_TEXT, type AssistAction } from '@/lib/notes/aiAssist'

export interface AssistTarget {
  text: string
  /** Selection range the text came from; null when the whole block/note was used. */
  selection: { from: number; to: number } | null
  /** Document position just after the top-level block that ends the context. */
  insertAt: number
}

const BLOCK_SEPARATOR = '\n\n'

function clip(text: string, action: AssistAction): string {
  if (text.length <= MAX_ASSIST_TEXT) return text
  // Continuing cares about where the text ends; everything else about where it starts.
  return action === 'continue'
    ? text.slice(text.length - MAX_ASSIST_TEXT)
    : text.slice(0, MAX_ASSIST_TEXT)
}

export function resolveAssistTarget(editor: Editor, action: AssistAction): AssistTarget {
  const { doc, selection } = editor.state
  const { from, to, empty, $to, $from } = selection
  const insertAt = $to.depth >= 1 ? $to.after(1) : doc.content.size

  if (!empty) {
    const text = doc.textBetween(from, to, BLOCK_SEPARATOR, '\n').trim()
    if (text) return { text: clip(text, action), selection: { from, to }, insertAt }
  }

  if (action !== 'continue' && $from.depth >= 1) {
    const block = $from.node(1).textContent.trim()
    if (block) return { text: clip(block, action), selection: null, insertAt }
  }

  const whole = doc.textBetween(0, doc.content.size, BLOCK_SEPARATOR, '\n').trim()
  return { text: clip(whole, action), selection: null, insertAt: doc.content.size }
}
