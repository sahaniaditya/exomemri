import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import { MAX_ASSIST_TEXT } from './aiAssist'
import { resolveAssistTarget } from './assistInput'

let editor: Editor | null = null

function make(html: string): Editor {
  editor = new Editor({ extensions: [StarterKit], content: html })
  return editor
}

afterEach(() => {
  editor?.destroy()
  editor = null
})

describe('resolveAssistTarget', () => {
  it('uses the selection when there is one', () => {
    const e = make('<p>Hello world</p><p>Second</p>')
    e.commands.setTextSelection({ from: 1, to: 6 })
    const target = resolveAssistTarget(e, 'summarize')
    expect(target.text).toBe('Hello')
    expect(target.selection).toEqual({ from: 1, to: 6 })
    expect(target.insertAt).toBe(13) // end of the first paragraph
  })

  it('falls back to the current block without a selection', () => {
    const e = make('<p>First</p><p>Second block</p>')
    e.commands.setTextSelection(18)
    const target = resolveAssistTarget(e, 'rewrite')
    expect(target.text).toBe('Second block')
    expect(target.selection).toBeNull()
  })

  it('uses the whole note for continue without a selection', () => {
    const e = make('<p>First</p><p>Second</p>')
    e.commands.setTextSelection(3)
    const target = resolveAssistTarget(e, 'continue')
    expect(target.text).toBe('First\n\nSecond')
    expect(target.insertAt).toBe(e.state.doc.content.size)
  })

  it('uses the whole note when the current block is empty', () => {
    const e = make('<p>Text</p><p></p>')
    e.commands.setTextSelection(e.state.doc.content.size - 1)
    expect(resolveAssistTarget(e, 'summarize').text).toBe('Text')
  })

  it('returns empty text for an empty note', () => {
    expect(resolveAssistTarget(make('<p></p>'), 'summarize').text).toBe('')
  })

  it('clips to the server limit, keeping the head except for continue', () => {
    const long = 'a'.repeat(MAX_ASSIST_TEXT) + 'END'
    const e = make(`<p>${long}</p>`)
    e.commands.selectAll()
    expect(resolveAssistTarget(e, 'summarize').text).toHaveLength(MAX_ASSIST_TEXT)
    expect(resolveAssistTarget(e, 'summarize').text.endsWith('END')).toBe(false)
    const tail = resolveAssistTarget(e, 'continue').text
    expect(tail).toHaveLength(MAX_ASSIST_TEXT)
    expect(tail.endsWith('END')).toBe(true)
  })
})
