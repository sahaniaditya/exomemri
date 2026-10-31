import { useEffect, useReducer } from 'react'
import type { Editor } from '@tiptap/core'

/** Re-render the calling component whenever the editor state changes (selection or content). */
export function useEditorTick(editor: Editor | null): void {
  const [, bump] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    if (!editor) return
    editor.on('transaction', bump)
    return () => {
      editor.off('transaction', bump)
    }
  }, [editor])
}
