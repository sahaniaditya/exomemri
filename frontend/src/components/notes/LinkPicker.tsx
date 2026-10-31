'use client'

/**
 * Dialog behind the "Capture" and "Link to page" slash items. Mount it next
 * to the editor; it opens on the `notes:link-picker` event the slash items
 * dispatch and inserts the chosen embed / mention where the slash was typed.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/core'
import {
  filterLinkables,
  getNoteIdFromPath,
  loadLinkables,
  type LinkableItem,
} from '@/lib/notes/linkables'
import {
  LINK_PICKER_EVENT,
  linkNodeFor,
  type LinkPickerDetail,
} from '@/lib/notes/linkPicker'
import NotesModal from './NotesModal'
import styles from './notes.module.css'

interface LinkPickerProps {
  editor: Editor | null
  spaceId: string
}

export default function LinkPicker({ editor, spaceId }: LinkPickerProps) {
  const [detail, setDetail] = useState<LinkPickerDetail | null>(null)

  useEffect(() => {
    const dom = editor?.view.dom
    if (!dom) return
    const onOpen = (event: Event) => setDetail((event as CustomEvent<LinkPickerDetail>).detail)
    dom.addEventListener(LINK_PICKER_EVENT, onOpen)
    return () => dom.removeEventListener(LINK_PICKER_EVENT, onOpen)
  }, [editor])

  if (!editor || !detail) return null
  return (
    <PickerDialog
      editor={editor}
      spaceId={spaceId}
      detail={detail}
      onClose={() => {
        setDetail(null)
        editor.commands.focus()
      }}
    />
  )
}

function PickerDialog({
  editor,
  spaceId,
  detail,
  onClose,
}: {
  editor: Editor
  spaceId: string
  detail: LinkPickerDetail
  onClose: () => void
}) {
  const [items, setItems] = useState<LinkableItem[] | null>(null)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const wantsCapture = detail.mode === 'capture'

  useEffect(() => {
    let alive = true
    loadLinkables(spaceId, getNoteIdFromPath(window.location.pathname))
      .then(all => alive && setItems(all))
      .catch(caught => {
        if (!alive) return
        console.error('Link picker failed to load:', caught)
        setError(true)
      })
    return () => {
      alive = false
    }
  }, [spaceId])

  const visible = useMemo(() => {
    const pool = (items ?? []).filter(i => (wantsCapture ? i.kind === 'source' : i.kind === 'note'))
    return filterLinkables(pool, query, 50)
  }, [items, query, wantsCapture])

  const choose = (item: LinkableItem) => {
    editor
      .chain()
      .focus()
      .insertContentAt(detail.pos, linkNodeFor(item, detail.mode))
      .run()
    onClose()
  }

  return (
    <NotesModal label={wantsCapture ? 'Embed a capture' : 'Link to a page'} onClose={onClose}>
      <input
        data-autofocus
        className={styles.switchInput}
        type="text"
        aria-label="Filter"
        placeholder={wantsCapture ? 'Search captures…' : 'Search pages…'}
        value={query}
        onChange={event => setQuery(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && visible[0]) {
            event.preventDefault()
            choose(visible[0])
          }
        }}
      />
      <div className={styles.modalBody}>
        {error && <p className={styles.modalError} role="alert">Could not load this space.</p>}
        {!error && items === null && <p className={styles.modalEmpty}>Loading…</p>}
        {!error && items !== null && visible.length === 0 && (
          <p className={styles.modalEmpty}>
            {wantsCapture ? 'No captures found.' : 'No pages found.'}
          </p>
        )}
        <ul className={styles.switchList}>
          {visible.map(item => (
            <li key={`${item.kind}-${item.id}`}>
              <button
                type="button"
                className={`${styles.suggestItem}`}
                onClick={() => choose(item)}
              >
                <span aria-hidden="true">{item.kind === 'source' ? '📎' : item.detail || '📄'}</span>
                <span>{item.title}</span>
                {item.kind === 'source' && item.detail && (
                  <span className={styles.suggestKind}>{item.detail.replace('_', ' ')}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </NotesModal>
  )
}
