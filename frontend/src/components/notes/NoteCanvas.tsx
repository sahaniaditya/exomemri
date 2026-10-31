'use client'

/**
 * The full-page note: top bar, large title, editor, autosave and conflict handling.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/react'
import { type NotePage } from '@/lib/notes'
import { exportMarkdownUrl, patchPage } from '@/lib/notes/client'
import type { WorkspacePage } from '@/lib/notes/types'
import {
  readFullWidth,
  serverFullWidth,
  subscribeFullWidth,
  writeFullWidth,
} from '@/lib/notes/fullWidthPref'
import { useAutosave, SESSION_EXPIRED_MESSAGE, type AutosaveField } from './hooks/useAutosave'
import { useIdleSnapshot } from './hooks/useIdleSnapshot'
import AiAssistMenu from './AiAssistMenu'
import BacklinksPanel from './BacklinksPanel'
import LinkPicker from './LinkPicker'
import NoteBlockTools from './NoteBlockTools'
import NoteEditorCore from './NoteEditorCore'
import NoteHeaderMeta from './NoteHeaderMeta'
import NoteTopBar from './NoteTopBar'
import { useNotesWorkspace } from './NotesWorkspaceContext'
import OutlinePanel from './OutlinePanel'
import VersionHistory from './VersionHistory'
import styles from './notes.module.css'

export const MAX_TITLE_LENGTH = 120

interface NoteCanvasProps {
  spaceId: string
  spaceName: string
  /** The workspace fields are absent for pages loaded through the legacy list. */
  note: NotePage & Partial<Pick<WorkspacePage, 'icon' | 'cover_key' | 'full_width'>>
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
  const [editor, setEditor] = useState<Editor | null>(null)
  const [outlineDoc, setOutlineDoc] = useState<unknown>(note.content)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [dirtySinceSnapshot, setDirtySinceSnapshot] = useState(false)
  const [savedAtMs, setSavedAtMs] = useState<number | null>(null)
  const workspace = useNotesWorkspace()
  const patchTree = workspace?.tree.patchLocal
  const titleRef = useRef(note.title)
  const savedTitleRef = useRef(note.title)

  const read = useCallback((field: AutosaveField): unknown => {
    if (field === 'title') return validTitle(titleRef.current) ?? undefined
    return editorRef.current?.getJSON()
  }, [])

  const handleSaved = useCallback(
    (saved: NotePage) => {
      savedTitleRef.current = saved.title
      setSavedAtMs(Date.now())
      setDirtySinceSnapshot(true)
      patchTree?.(saved.id, { title: saved.title })
    },
    [patchTree]
  )

  const autosave = useAutosave({
    endpoint: `/api/spaces/${spaceId}/notes/${note.id}`,
    initialUpdatedAt: note.updated_at,
    read,
    onSaved: handleSaved,
  })
  const { markDirty, flush, adoptUpdatedAt } = autosave

  const handleEditorReady = useCallback((next: Editor | null) => {
    editorRef.current = next
    setEditor(next)
  }, [])

  const handleContentChange = useCallback(() => {
    markDirty('content')
    const current = editorRef.current
    if (current) setOutlineDoc(current.getJSON())
  }, [markDirty])

  useIdleSnapshot({
    spaceId,
    noteId: note.id,
    dirtySinceSnapshot,
    lastSavedAt: savedAtMs,
    onSnapshotted: () => setDirtySinceSnapshot(false),
  })

  // The page's saved width (server) is the source of truth; the local store drives rendering.
  useEffect(() => {
    if (typeof note.full_width === 'boolean') writeFullWidth(note.full_width)
  }, [note.full_width])

  /** Icon, cover and width are saved by `NoteHeaderMeta`; keep autosave and the tree in step. */
  const handleMetaSaved = useCallback(
    (page: WorkspacePage) => {
      adoptUpdatedAt(page.updated_at)
      writeFullWidth(page.full_width)
      patchTree?.(page.id, { icon: page.icon })
    },
    [adoptUpdatedAt, patchTree]
  )

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
    const next = !fullWidth
    writeFullWidth(next)
    // Persist per page too; a failure only means the preference stays on this device.
    patchPage(spaceId, note.id, { full_width: next })
      .then(page => adoptUpdatedAt(page.updated_at))
      .catch(error => console.error('Saving page width failed:', error))
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
        actions={
          <>
            <button type="button" className={styles.widthToggle} onClick={() => setHistoryOpen(true)}>
              History
            </button>
            <a
              className={styles.widthToggle}
              href={exportMarkdownUrl(spaceId, note.id)}
              download={`${title.trim() || 'Untitled'}.md`}
            >
              Export
            </a>
          </>
        }
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

      <div className={styles.pageRow}>
      <main className={`${styles.body} ${fullWidth ? styles.bodyWide : ''}`} data-full-width={fullWidth}>
        <NoteHeaderMeta
          spaceId={spaceId}
          noteId={note.id}
          icon={note.icon ?? null}
          coverKey={note.cover_key ?? null}
          fullWidth={fullWidth}
          onSaved={handleMetaSaved}
        />
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
        <NoteBlockTools editor={editor} />
        <LinkPicker editor={editor} spaceId={spaceId} />
        <AiAssistMenu editor={editor} spaceId={spaceId} noteId={note.id} />
      </main>
      <aside className={styles.sidePanel} aria-label="Page outline and links">
        <OutlinePanel doc={outlineDoc} editor={editor} />
        <BacklinksPanel spaceId={spaceId} noteId={note.id} refreshKey={autosave.lastSavedAt} />
      </aside>
      </div>

      <VersionHistory
        open={historyOpen}
        spaceId={spaceId}
        noteId={note.id}
        onClose={() => setHistoryOpen(false)}
        // A restore rewrites the page on the server; reloading is the clean way to pick it up.
        onRestored={() => reload()}
      />
    </div>
  )
}
