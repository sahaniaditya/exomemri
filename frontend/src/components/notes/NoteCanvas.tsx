'use client'

/**
 * The full-page note: top bar, large title, editor, autosave and conflict handling.
 */
import { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/react'
import { type NotePage } from '@/lib/notes'
import {
  readFullWidth,
  serverFullWidth,
  subscribeFullWidth,
  writeFullWidth,
} from '@/lib/notes/fullWidthPref'
import { useAutosave, SESSION_EXPIRED_MESSAGE, type AutosaveField } from './hooks/useAutosave'
import NoteEditorCore from './NoteEditorCore'
import NoteTopBar from './NoteTopBar'
import styles from './notes.module.css'

export const MAX_TITLE_LENGTH = 120

interface NoteCanvasProps {
  spaceId: string
  spaceName: string
  note: NotePage
  /** Overridable for tests. */
  onReload?: () => void
}

/** A title is saveable when it has 1 to 120 characters after trimming. */
export function validTitle(raw: string): string | null {
  const trimmed = raw.trim()
  return trimmed.length >= 1 && trimmed.length <= MAX_TITLE_LENGTH ? trimmed : null
}

export default function NoteCanvas({ spaceId, spaceName, note, onReload }: NoteCanvasProps) {
  const scope = { kind: 'space' as const, spaceId }
  const [title, setTitle] = useState(note.title)
  const fullWidth = useSyncExternalStore(subscribeFullWidth, readFullWidth, serverFullWidth)
  const editorRef = useRef<Editor | null>(null)
  const titleRef = useRef(note.title)
  const savedTitleRef = useRef(note.title)

  const read = useCallback((field: AutosaveField): unknown => {
    if (field === 'title') return validTitle(titleRef.current) ?? undefined
    return editorRef.current?.getJSON()
  }, [])

  const handleSaved = useCallback((saved: NotePage) => {
    savedTitleRef.current = saved.title
  }, [])

  const autosave = useAutosave({
    endpoint: `/api/spaces/${spaceId}/notes/${note.id}`,
    initialUpdatedAt: note.updated_at,
    read,
    onSaved: handleSaved,
  })
  const { markDirty, flush } = autosave

  const handleEditorReady = useCallback((editor: Editor | null) => {
    editorRef.current = editor
  }, [])

  const handleContentChange = useCallback(() => markDirty('content'), [markDirty])

  function handleTitleChange(value: string) {
    setTitle(value)
    titleRef.current = value
    if (validTitle(value) !== null) markDirty('title')
  }

  function handleTitleBlur() {
    if (validTitle(title) === null) {
      // Empty (or whitespace-only) titles revert to the last saved name.
      setTitle(savedTitleRef.current)
      titleRef.current = savedTitleRef.current
      return
    }
    flush()
  }

  function toggleFullWidth() {
    writeFullWidth(!fullWidth)
  }

  const reload = onReload ?? (() => window.location.reload())
  const isAuthError = autosave.errorMessage === SESSION_EXPIRED_MESSAGE

  let statusText = ''
  switch (autosave.status) {
    case 'saving':
      statusText = 'Saving…'
      break
    case 'dirty':
      statusText = 'Unsaved changes'
      break
    case 'error':
      statusText = autosave.errorMessage ?? 'Couldn’t save.'
      break
    case 'conflict':
      statusText = 'Not saved — conflict'
      break
    default:
      statusText = 'Saved'
  }

  return (
    <div className={styles.canvas}>
      <NoteTopBar
        spaceId={spaceId}
        spaceName={spaceName}
        title={title}
        statusText={statusText}
        statusTone={autosave.status === 'error' || autosave.status === 'conflict' ? 'error' : 'neutral'}
        onRetry={autosave.status === 'error' && !isAuthError ? autosave.retry : undefined}
        fullWidth={fullWidth}
        onToggleFullWidth={toggleFullWidth}
      />

      {autosave.status === 'conflict' ? (
        <div className={styles.banner} role="alert">
          <span>This page was changed in another tab or device.</span>
          <div className={styles.bannerActions}>
            <button type="button" className={styles.linkBtn} onClick={reload}>
              Reload latest
            </button>
            <button type="button" className={styles.linkBtn} onClick={autosave.keepMine}>
              Keep my version
            </button>
          </div>
        </div>
      ) : null}

      <main className={`${styles.body} ${fullWidth ? styles.bodyWide : ''}`} data-full-width={fullWidth}>
        <label htmlFor="note-title" className={styles.srOnly}>
          Page title
        </label>
        <input
          id="note-title"
          className={styles.titleInput}
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="Untitled"
          onChange={event => handleTitleChange(event.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              editorRef.current?.commands.focus('start')
            }
          }}
        />
        <NoteEditorCore
          scope={scope}
          initialContent={note.content}
          onChange={handleContentChange}
          onBlur={flush}
          onEditorReady={handleEditorReady}
        />
      </main>
    </div>
  )
}
