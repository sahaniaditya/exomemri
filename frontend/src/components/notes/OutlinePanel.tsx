'use client'

/** Heading outline of the open page; clicking an entry scrolls to it. */
import { useMemo } from 'react'
import type { Editor } from '@tiptap/core'
import { extractOutline } from '@/lib/notes/outline'
import styles from './notes.module.css'

interface OutlinePanelProps {
  /** TipTap JSON of the page (`editor.getJSON()`); update it as the page changes. */
  doc: unknown
  editor: Editor | null
}

/** Put the caret in the heading at `pos` and scroll it into view. */
export function scrollToHeading(editor: Editor, pos: number): void {
  const dom = editor.view.nodeDOM(pos)
  if (dom instanceof HTMLElement) dom.scrollIntoView({ behavior: 'smooth', block: 'start' })
  editor.commands.setTextSelection(pos + 1)
}

export default function OutlinePanel({ doc, editor }: OutlinePanelProps) {
  const entries = useMemo(() => extractOutline(doc), [doc])

  return (
    <nav className={styles.panel} aria-label="Outline">
      <h2 className={styles.panelTitle}>Outline</h2>
      {entries.length === 0 ? (
        <p className={styles.panelEmpty}>Add headings to see an outline.</p>
      ) : (
        <ul className={styles.panelList}>
          {entries.map(entry => (
            <li key={`${entry.pos}`}>
              <button
                type="button"
                className={styles.outlineBtn}
                data-level={entry.level}
                disabled={!editor}
                onClick={() => editor && scrollToHeading(editor, entry.pos)}
              >
                {entry.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}
