/**
 * Browser client + pure helpers for in-note AI assist. Calls the local BFF only.
 */

export type AssistAction = 'summarize' | 'rewrite' | 'expand' | 'continue' | 'ask'

export const AI_ASSIST_EVENT = 'notes:ai-assist'
export const MAX_ASSIST_TEXT = 8000

export interface AssistRequest {
  action: AssistAction
  text: string
  instruction?: string
  noteId?: string
}

export type AssistErrorKind = 'credits' | 'rate' | 'network' | 'server'

export type AssistResult =
  | { ok: true; text: string }
  | { ok: false; kind: AssistErrorKind; message: string }
  | { ok: false; kind: 'aborted'; message: '' }

export const ASSIST_ERROR_MESSAGE: Record<AssistErrorKind, string> = {
  credits: "You're out of credits. AI assist unlocks when your monthly allowance resets.",
  rate: 'Too many AI requests in a short time. Wait a minute and try again.',
  network: "Couldn't reach the server. Check your connection and try again.",
  server: 'Something went wrong, so nothing was inserted and no credit was used. Try again.',
}

export function errorKindForStatus(status: number): AssistErrorKind {
  if (status === 402) return 'credits'
  if (status === 429) return 'rate'
  return 'server'
}

export const ASSIST_LABEL: Record<AssistAction, string> = {
  summarize: 'Summarize',
  rewrite: 'Rewrite',
  expand: 'Expand',
  continue: 'Continue writing',
  ask: 'Ask AI',
}

export async function requestAssist(
  spaceId: string,
  body: AssistRequest,
  signal?: AbortSignal
): Promise<AssistResult> {
  const payload: Record<string, unknown> = { action: body.action, text: body.text }
  if (body.instruction) payload.instruction = body.instruction
  if (body.noteId) payload.note_id = body.noteId
  let res: Response
  try {
    res = await fetch(`/api/spaces/${spaceId}/notes/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, kind: 'aborted', message: '' }
    }
    return { ok: false, kind: 'network', message: ASSIST_ERROR_MESSAGE.network }
  }
  if (!res.ok) {
    const kind = errorKindForStatus(res.status)
    return { ok: false, kind, message: ASSIST_ERROR_MESSAGE[kind] }
  }
  try {
    const data = (await res.json()) as { text?: unknown }
    if (typeof data.text === 'string' && data.text.trim()) {
      return { ok: true, text: data.text }
    }
  } catch {
    // fall through to the server error below
  }
  return { ok: false, kind: 'server', message: ASSIST_ERROR_MESSAGE.server }
}

/** Plain AI text to TipTap JSON: blank-line separated paragraphs, newlines as breaks. */
export function textToParagraphs(text: string): Record<string, unknown>[] {
  return text
    .trim()
    .split(/\n{2,}/)
    .filter(chunk => chunk.trim())
    .map(chunk => {
      const content: Record<string, unknown>[] = []
      chunk.split('\n').forEach((line, index) => {
        if (index > 0) content.push({ type: 'hardBreak' })
        if (line) content.push({ type: 'text', text: line })
      })
      return { type: 'paragraph', content }
    })
}

/** Inline text nodes for replacing a selection when the result is a single paragraph. */
export function singleParagraphInline(text: string): Record<string, unknown>[] | null {
  const paragraphs = textToParagraphs(text)
  if (paragraphs.length !== 1) return null
  return paragraphs[0].content as Record<string, unknown>[]
}
