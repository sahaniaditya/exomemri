'use client'

import { useCallback } from 'react'
import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/react/menus'
import { useEditorTick } from './hooks/useEditorTick'
import styles from './note-blocks.module.css'

/** The table tools show while the cursor is inside a table of an editable editor. */
export function shouldShowTableMenu({ editor }: { editor: Editor }): boolean {
  return editor.isEditable && editor.isActive('table')
}

// Stable reference: a new object per render makes the plugin dispatch a transaction, re-rendering us.
const BUBBLE_OPTIONS = { placement: 'top-start', offset: 8 } as const

/** Anchor the menu to the table itself rather than to the cursor. */
function tableAnchor(editor: Editor) {
  const { $from } = editor.state.selection
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'table') {
      const dom = editor.view.nodeDOM($from.before(d))
      if (dom instanceof HTMLElement) {
        return { getBoundingClientRect: () => dom.getBoundingClientRect(), contextElement: dom }
      }
    }
  }
  return null
}

interface TableAction {
  label: string
  text: string
  run: (editor: Editor) => void
  danger?: boolean
}

const ACTIONS: TableAction[] = [
  { label: 'Add row above', text: '↑ Row', run: (e) => e.chain().focus().addRowBefore().run() },
  { label: 'Add row below', text: '↓ Row', run: (e) => e.chain().focus().addRowAfter().run() },
  { label: 'Add column left', text: '← Col', run: (e) => e.chain().focus().addColumnBefore().run() },
  { label: 'Add column right', text: '→ Col', run: (e) => e.chain().focus().addColumnAfter().run() },
  { label: 'Delete row', text: '– Row', run: (e) => e.chain().focus().deleteRow().run(), danger: true },
  { label: 'Delete column', text: '– Col', run: (e) => e.chain().focus().deleteColumn().run(), danger: true },
  { label: 'Toggle header row', text: 'Header', run: (e) => e.chain().focus().toggleHeaderRow().run() },
  { label: 'Delete table', text: 'Delete table', run: (e) => e.chain().focus().deleteTable().run(), danger: true },
]

export default function TableMenu({ editor }: { editor: Editor | null }) {
  useEditorTick(editor)
  // Stable identity, for the same reason as BUBBLE_OPTIONS.
  const anchor = useCallback(() => (editor ? tableAnchor(editor) : null), [editor])
  if (!editor) return null

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={shouldShowTableMenu}
      getReferencedVirtualElement={anchor}
      options={BUBBLE_OPTIONS}
    >
      <div className={styles.menu} role="toolbar" aria-label="Table tools" data-testid="table-menu">
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            className={`${styles.btn} ${a.danger ? styles.itemDanger : ''}`}
            aria-label={a.label}
            title={a.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => a.run(editor)}
          >
            {a.text}
          </button>
        ))}
      </div>
    </BubbleMenu>
  )
}
