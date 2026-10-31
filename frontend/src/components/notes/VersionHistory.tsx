'use client'

/**
 * Side panel listing a note's saved versions, with a read-only preview and a
 * confirmed Restore. The server snapshots the current state before restoring, so
 * a restore can itself be undone from this list.
 */
import { useEffect, useRef, useState } from 'react'

import { relativeTime } from '@/lib/dashboard-data'
import {
  VERSION_REASON_LABEL,
  getVersion,
  listVersions,
  restoreVersion,
  type NoteVersion,
  type NoteVersionSummary,
  type RestoredNote,
} from '@/lib/notes/versions'
import NoteDocPreview from './NoteDocPreview'
import styles from './notes-intelligence.module.css'

type Load = 'loading' | 'ready' | 'error'

interface PanelProps {
  spaceId: string
  noteId: string
  onClose: () => void
  /** Called with the restored page so the open editor can reload its content. */
  onRestored: (page: RestoredNote) => void
}

/** Mounts the panel only while open, so every opening starts from fresh state. */
export default function VersionHistory({ open, ...panel }: PanelProps & { open: boolean }) {
  return open ? <VersionHistoryPanel {...panel} /> : null
}

function VersionHistoryPanel({ spaceId, noteId, onClose, onRestored }: PanelProps) {
  const [items, setItems] = useState<NoteVersionSummary[]>([])
  const [listState, setListState] = useState<Load>('loading')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<NoteVersion | null>(null)
  const [previewState, setPreviewState] = useState<Load>('ready')
  const [confirming, setConfirming] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const previewRequest = useRef(0)

  // Bumping reloadKey refetches the list (retry, and after a restore adds a snapshot).
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    listVersions(spaceId, noteId)
      .then(next => {
        if (cancelled) return
        setItems(next)
        setListState('ready')
      })
      .catch(() => {
        if (!cancelled) setListState('error')
      })
    return () => {
      cancelled = true
    }
  }, [spaceId, noteId, reloadKey])

  function retryList() {
    setListState('loading')
    setReloadKey(key => key + 1)
  }

  async function select(id: string) {
    const request = ++previewRequest.current
    setSelectedId(id)
    setPreview(null)
    setConfirming(false)
    setRestoreError(null)
    setPreviewState('loading')
    try {
      const version = await getVersion(spaceId, noteId, id)
      if (request !== previewRequest.current) return
      setPreview(version)
      setPreviewState('ready')
    } catch {
      if (request !== previewRequest.current) return
      setPreviewState('error')
    }
  }

  async function confirmRestore() {
    if (!selectedId) return
    setRestoring(true)
    setRestoreError(null)
    try {
      const page = await restoreVersion(spaceId, noteId, selectedId)
      setConfirming(false)
      onRestored(page)
      setReloadKey(key => key + 1)
    } catch {
      setRestoreError("Couldn't restore this version. Nothing was changed.")
    } finally {
      setRestoring(false)
    }
  }

  return (
    <aside className={styles.panel} role="dialog" aria-label="Version history">
      <header className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Version history</h2>
        <button type="button" className={styles.ghostButton} onClick={onClose}>
          Close
        </button>
      </header>

      <div className={styles.panelBody}>
        <div className={styles.versionList}>
          {listState === 'loading' && <p className={styles.status}>Loading versions…</p>}
          {listState === 'error' && (
            <p className={styles.statusError} role="alert">
              Couldn&apos;t load version history.{' '}
              <button type="button" className={styles.linkButton} onClick={retryList}>
                Retry
              </button>
            </p>
          )}
          {listState === 'ready' && items.length === 0 && (
            <p className={styles.status}>
              No versions yet. Versions are saved automatically while you write.
            </p>
          )}
          {listState === 'ready' && items.length > 0 && (
            <ul className={styles.versionItems}>
              {items.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`${styles.versionItem} ${
                      item.id === selectedId ? styles.versionItemActive : ''
                    }`}
                    aria-pressed={item.id === selectedId}
                    onClick={() => void select(item.id)}
                  >
                    <span className={styles.versionTitle}>{item.title}</span>
                    <span className={styles.versionMeta}>
                      {relativeTime(item.created_at)} · {VERSION_REASON_LABEL[item.reason]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.previewPane}>
          {!selectedId && listState === 'ready' && items.length > 0 && (
            <p className={styles.status}>Select a version to preview it.</p>
          )}
          {previewState === 'loading' && selectedId && (
            <p className={styles.status}>Loading preview…</p>
          )}
          {previewState === 'error' && selectedId && (
            <p className={styles.statusError} role="alert">
              Couldn&apos;t load this version.
            </p>
          )}
          {preview && previewState === 'ready' && (
            <>
              <NoteDocPreview content={preview.content} />
              {restoreError && (
                <p className={styles.statusError} role="alert">
                  {restoreError}
                </p>
              )}
              {confirming ? (
                <div className={styles.confirmRow}>
                  <span>Replace this note with the selected version?</span>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={restoring}
                    onClick={() => void confirmRestore()}
                  >
                    {restoring ? 'Restoring…' : 'Yes, restore'}
                  </button>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    disabled={restoring}
                    onClick={() => setConfirming(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => setConfirming(true)}
                >
                  Restore this version
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
