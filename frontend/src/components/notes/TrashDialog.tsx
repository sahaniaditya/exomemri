'use client'

/** Trashed pages: restore or delete forever (with confirmation). */
import { useEffect, useState } from 'react'
import { deleteForever, fetchTrash, restorePage } from '@/lib/notes/client'
import { NO_ICON } from '@/lib/notes/constants'
import type { NoteTrashItem } from '@/lib/notes/types'
import NotesModal from './NotesModal'
import styles from './notes.module.css'

interface TrashDialogProps {
  spaceId: string
  open: boolean
  onClose: () => void
  /** A page came back; the caller refreshes its tree. */
  onRestored?: (noteId: string) => void
}

export default function TrashDialog(props: TrashDialogProps) {
  return props.open ? <TrashContent {...props} /> : null
}

function formatDeleted(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : `Deleted ${date.toLocaleDateString()}`
}

function TrashContent({ spaceId, onClose, onRestored }: TrashDialogProps) {
  const [items, setItems] = useState<NoteTrashItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchTrash(spaceId)
      .then(list => alive && setItems(list))
      .catch(caught => {
        if (!alive) return
        console.error('Failed to load trash:', caught)
        setError('Could not load the trash.')
        setItems([])
      })
    return () => {
      alive = false
    }
  }, [spaceId])

  const reload = async () => {
    try {
      setItems(await fetchTrash(spaceId))
    } catch {
      // Keep the optimistic list; the next open refetches.
    }
  }

  const restore = async (item: NoteTrashItem) => {
    setBusy(item.id)
    setError(null)
    try {
      await restorePage(spaceId, item.id)
      onRestored?.(item.id)
      await reload()
    } catch (caught) {
      console.error('Restore failed:', caught)
      setError('Could not restore that page.')
    } finally {
      setBusy(null)
    }
  }

  const remove = async (item: NoteTrashItem) => {
    setBusy(item.id)
    setError(null)
    try {
      await deleteForever(spaceId, item.id)
      setConfirming(null)
      await reload()
    } catch (caught) {
      console.error('Permanent delete failed:', caught)
      setError('Could not delete that page.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <NotesModal label="Trash" onClose={onClose}>
      <div className={styles.modalBody}>
        {error && (
          <p className={styles.modalError} role="alert">
            {error}
          </p>
        )}
        {items === null && <p className={styles.modalEmpty}>Loading…</p>}
        {items?.length === 0 && !error && (
          <p className={styles.modalEmpty}>
            Trash is empty. Deleted pages stay here for 30 days.
          </p>
        )}
        {items?.map(item => (
          <div key={item.id} className={styles.trashRow}>
            <div className={styles.trashInfo}>
              <span>
                <span aria-hidden="true">{item.icon || NO_ICON}</span> {item.title}
              </span>
              <span className={styles.trashMeta}>{formatDeleted(item.deleted_at)}</span>
            </div>
            <div className={styles.trashActions}>
              {confirming === item.id ? (
                <>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    disabled={busy === item.id}
                    onClick={() => void remove(item)}
                  >
                    Confirm delete
                  </button>
                  <button type="button" className={styles.btn} onClick={() => setConfirming(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={busy === item.id}
                    onClick={() => void restore(item)}
                    aria-label={`Restore ${item.title}`}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    onClick={() => setConfirming(item.id)}
                    aria-label={`Delete ${item.title} forever`}
                  >
                    Delete forever
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </NotesModal>
  )
}
