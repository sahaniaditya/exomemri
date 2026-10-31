import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/core'

import { AI_ASSIST_EVENT } from '@/lib/notes/aiAssist'
import { aiSlashItems } from './items-ai'

function fakeEditor() {
  const run = vi.fn()
  const deleteRange = vi.fn(() => ({ run }))
  const focus = vi.fn(() => ({ deleteRange }))
  const chain = vi.fn(() => ({ focus }))
  return { editor: { chain } as unknown as Editor, deleteRange, run }
}

describe('aiSlashItems', () => {
  afterEach(() => vi.restoreAllMocks())

  it('exposes Summarize, Continue writing and Ask AI in the AI group', () => {
    expect(aiSlashItems.map(i => i.title)).toEqual(['Summarize', 'Continue writing', 'Ask AI'])
    expect(aiSlashItems.every(i => i.group === 'AI' && i.keywords.length > 0)).toBe(true)
    expect(new Set(aiSlashItems.map(i => i.id)).size).toBe(3)
  })

  it.each([
    ['ai-summarize', 'summarize'],
    ['ai-continue', 'continue'],
    ['ai-ask', 'ask'],
  ])('%s removes the slash text and requests the %s action', (id, action) => {
    const { editor, deleteRange, run } = fakeEditor()
    const listener = vi.fn()
    window.addEventListener(AI_ASSIST_EVENT, listener)
    const range = { from: 4, to: 9 }
    aiSlashItems.find(i => i.id === id)!.run({ editor, range })
    window.removeEventListener(AI_ASSIST_EVENT, listener)

    expect(deleteRange).toHaveBeenCalledWith(range)
    expect(run).toHaveBeenCalled()
    expect(listener).toHaveBeenCalledTimes(1)
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ action })
  })
})
