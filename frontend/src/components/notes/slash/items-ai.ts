import { AI_ASSIST_EVENT, type AssistAction } from '@/lib/notes/aiAssist'
import type { SlashItem } from './types'

function aiItem(
  id: string,
  title: string,
  description: string,
  keywords: string[],
  action: AssistAction
): SlashItem {
  return {
    id,
    title,
    description,
    keywords,
    group: 'AI',
    icon: '✦',
    run: ({ editor, range }) => {
      // Remove the typed "/command" first; AiAssistMenu picks the request up from the event.
      editor.chain().focus().deleteRange(range).run()
      window.dispatchEvent(new CustomEvent(AI_ASSIST_EVENT, { detail: { action } }))
    },
  }
}

export const aiSlashItems: SlashItem[] = [
  aiItem(
    'ai-summarize',
    'Summarize',
    'Summarize the selection or this block',
    ['ai', 'summary', 'tldr', 'shorten'],
    'summarize'
  ),
  aiItem(
    'ai-continue',
    'Continue writing',
    'Let AI continue from where you stopped',
    ['ai', 'continue', 'write', 'next'],
    'continue'
  ),
  aiItem(
    'ai-ask',
    'Ask AI',
    'Ask a question about the selection or this note',
    ['ai', 'ask', 'question', 'explain'],
    'ask'
  ),
]
