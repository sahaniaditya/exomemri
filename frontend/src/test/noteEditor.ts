import { closeHistory as pmCloseHistory } from '@tiptap/pm/history'
import { Editor, type Content, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { blockExtensions } from '@/components/notes/extensions/blocks'

/** Headless editor with StarterKit + the Phase 2 block extensions (the production combination). */
/** Mirrors the app's image node, which stores the storage key as `attrs.key`. */
const NoteImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), key: { default: null } }
  },
})

export function createEditor(content: Content = { type: 'doc', content: [{ type: 'paragraph' }] }) {
  // Attached to the document so native events (checkbox change on click) behave like a browser.
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      NoteImage.configure({ inline: false }),
      ...blockExtensions(),
    ],
    content,
  })
  editor.on('destroy', () => element.remove())
  return editor
}

/** Force the next change into its own undo step (history otherwise groups edits < 500 ms apart). */
export function closeHistory(editor: Editor): void {
  editor.view.dispatch(pmCloseHistory(editor.state.tr))
}

/** Dispatch a key press through ProseMirror's keydown handlers; returns whether it was handled. */
export function pressKey(editor: Editor, key: string, init: KeyboardEventInit = {}): boolean {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  return Boolean(editor.view.someProp('handleKeyDown', (f) => f(editor.view, event)))
}

/** Type text one character at a time so input rules fire like in a browser. */
export function typeText(editor: Editor, text: string): void {
  for (const ch of text) {
    const { from, to } = editor.state.selection
    const handled = editor.view.someProp('handleTextInput', (f) => f(editor.view, from, to, ch, () => editor.state.tr))
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(ch, from, to))
  }
}

export const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })
export const p = (text?: string): JSONContent =>
  text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' }

/** `editor.getJSON()` typed as plain `JSONContent` so tests can index into it freely. */
export const getDoc = (editor: Editor): JSONContent => editor.getJSON() as JSONContent
