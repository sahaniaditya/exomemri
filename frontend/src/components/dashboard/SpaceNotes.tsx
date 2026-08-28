'use client'

/**
 * Space-scoped named note pages. Header + empty state match the space-notes
 * plate design (numbered title, outlined + New page, muted empty copy).
 */
import { useCallback, useState } from 'react'
import NotePageEditor from './NotePageEditor'
import styles from './dashboard.module.css'
import {
  EMPTY_NOTE_DOC,
  notesApiBase,
  type NotePage,
} from '@/lib/notes'

interface SpaceNotesProps {
  spaceId: string
  plateNum?: string
  initialNotes: NotePage[]
  loadError?: boolean
}

export default function SpaceNotes({
  spaceId,
  plateNum = '02',
  initialNotes,
  loadError = false,
}: SpaceNotesProps) {
  const scope = { kind: 'space' as const, spaceId }
  const apiBase = notesApiBase(scope)
  const [pages, setPages] = useState<NotePage[]>(initialNotes)
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => (initialNotes[0] ? new Set([initialNotes[0].id]) : new Set())
  )
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({})

  const handleDraft = useCallback((pageId: string, content: Record<string, unknown>) => {
    setDrafts(prev => ({ ...prev, [pageId]: content }))
  }, [])

  const handleSaved = useCallback((saved: NotePage) => {
    setDrafts(prev => ({ ...prev, [saved.id]: saved.content }))
    setPages(prev => prev.map(item => (item.id === saved.id ? saved : item)))
  }, [])

  function toggle(id: string) {
    if (renamingId === id) return
    setOpenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startRename(page: NotePage) {
    setRenamingId(page.id)
    setRenameValue(page.title)
    setRenameError(null)
  }

  async function createPage() {
    if (busyId) return
    setBusyId('create')
    setListError(null)
    try {
      const res = await fetch(`${apiBase}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.status === 409) {
        setListError('This space already has the maximum number of pages (50).')
        return
      }
      if (res.status === 401) {
        setListError('Your session has expired. Please log in again.')
        return
      }
      if (!res.ok) {
        setListError('Could not create a page. Please try again.')
        return
      }
      const page = (await res.json()) as NotePage
      setDrafts(prev => ({ ...prev, [page.id]: page.content ?? EMPTY_NOTE_DOC }))
      setPages(prev => [...prev, page])
      setOpenIds(prev => new Set(prev).add(page.id))
      startRename(page)
    } catch {
      setListError('Could not reach the server. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function submitRename(pageId: string) {
    const trimmed = renameValue.trim()
    if (!trimmed) {
      setRenameError('Give this page a name.')
      return
    }
    setBusyId(pageId)
    setRenameError(null)
    try {
      const res = await fetch(`${apiBase}/notes/${pageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      })
      if (res.status === 401) {
        setRenameError('Your session has expired. Please log in again.')
        return
      }
      if (!res.ok) {
        setRenameError('Could not rename the page. Please try again.')
        return
      }
      const saved = (await res.json()) as NotePage
      setPages(prev =>
        prev.map(page =>
          page.id === pageId
            ? { ...page, title: saved.title, updated_at: saved.updated_at }
            : page
        )
      )
      setRenamingId(null)
    } catch {
      setRenameError('Could not reach the server. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function removePage(page: NotePage) {
    const ok = window.confirm(
      `Delete “${page.title}”? This page is removed permanently.`
    )
    if (!ok) return
    setBusyId(page.id)
    setListError(null)
    try {
      const res = await fetch(`${apiBase}/notes/${page.id}`, {
        method: 'DELETE',
      })
      if (res.status === 401) {
        setListError('Your session has expired. Please log in again.')
        return
      }
      if (!res.ok && res.status !== 204) {
        setListError('Could not delete the page. Please try again.')
        return
      }
      setDrafts(prev => {
        const next = { ...prev }
        delete next[page.id]
        return next
      })
      setPages(prev => prev.filter(item => item.id !== page.id))
      setOpenIds(prev => {
        const next = new Set(prev)
        next.delete(page.id)
        return next
      })
      if (renamingId === page.id) setRenamingId(null)
    } catch {
      setListError('Could not reach the server. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className={styles.spaceNotes} aria-label="Space notes">
      <div className={styles.plate}>
        <span className={styles.platenum}>{plateNum}</span>
        <span className={styles.platetitle}>Space notes</span>
        <span className={styles.plateline} />
        <button
          type="button"
          className={styles.spaceNotesNewBtn}
          disabled={Boolean(busyId)}
          onClick={() => void createPage()}
        >
          <span aria-hidden="true">+</span>
          New page
        </button>
      </div>

      {listError ? <p className={styles.notesListError}>{listError}</p> : null}

      {pages.length === 0 ? (
        <div className={styles.notesEmpty}>
          <span className={styles.notesEmptyIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
              <path d="M7 3.5h7.5L19 8v12.5H7z" />
              <path d="M14.5 3.5V8H19" />
              <path d="M10 12h6M10 15.5h4" />
            </svg>
          </span>
          <div className={styles.notesEmptyTitle}>
            {loadError ? 'Couldn’t load notes' : 'Start your first page'}
          </div>
          <p className={styles.notesEmptyBody}>
            {loadError
              ? 'Refresh the page to try again.'
              : 'Jot down what you want to remember about this space.'}
          </p>
        </div>
      ) : (
        <div className={styles.notesPages}>
          {pages.map(page => {
            const open = openIds.has(page.id)
            const editing = renamingId === page.id
            return (
              <div key={page.id} className={styles.folderGroup}>
                <div className={styles.folderHead}>
                  {editing ? (
                    <>
                      <span className={styles.folderChevron} aria-hidden="true">
                        {open ? '▾' : '▸'}
                      </span>
                      <span className={styles.folderRename}>
                        <input
                          className={styles.folderRenameInput}
                          value={renameValue}
                          maxLength={120}
                          onChange={event => setRenameValue(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              void submitRename(page.id)
                            }
                            if (event.key === 'Escape') setRenamingId(null)
                          }}
                          aria-label="Page name"
                          autoFocus
                        />
                        <button
                          type="button"
                          className={styles.folderAction}
                          disabled={busyId === page.id}
                          onClick={() => void submitRename(page.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className={styles.folderAction}
                          onClick={() => setRenamingId(null)}
                        >
                          Cancel
                        </button>
                      </span>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.folderToggle}
                        aria-expanded={open}
                        aria-controls={`note-body-${page.id}`}
                        onClick={() => toggle(page.id)}
                      >
                        <span className={styles.folderChevron} aria-hidden="true">
                          {open ? '▾' : '▸'}
                        </span>
                        <span className={styles.folderTitle}>{page.title}</span>
                      </button>
                      <div className={styles.folderActions}>
                        <button
                          type="button"
                          className={styles.folderAction}
                          disabled={busyId === page.id}
                          onClick={() => startRename(page)}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className={styles.folderAction}
                          disabled={busyId === page.id}
                          onClick={() => void removePage(page)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {renameError && editing ? (
                  <div className={styles.folderError}>{renameError}</div>
                ) : null}
                {open ? (
                  <NotePageEditor
                    scope={scope}
                    pageId={page.id}
                    initialContent={
                      drafts[page.id] ?? page.content ?? EMPTY_NOTE_DOC
                    }
                    savedContent={page.content ?? EMPTY_NOTE_DOC}
                    savedAt={page.updated_at}
                    editable
                    onDraft={handleDraft}
                    onSaved={handleSaved}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
