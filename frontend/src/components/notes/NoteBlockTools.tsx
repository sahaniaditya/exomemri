'use client'

import type { Editor } from '@tiptap/core'
import BlockHandleMenu from './BlockHandleMenu'
import CalloutEmojiPicker from './CalloutEmojiPicker'
import SelectionMenu from './SelectionMenu'
import TableMenu from './TableMenu'

/**
 * Every floating tool for the Phase 2 blocks in one component: render it next to
 * `<EditorContent />` (inside the same client component that owns `editor`).
 */
export default function NoteBlockTools({ editor }: { editor: Editor | null }) {
  return (
    <>
      <SelectionMenu editor={editor} />
      <TableMenu editor={editor} />
      <BlockHandleMenu editor={editor} />
      <CalloutEmojiPicker editor={editor} />
    </>
  )
}
