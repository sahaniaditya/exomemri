'use client'

/**
 * Per-capture Move control. Lists Ungrouped, existing folders, and
 * "New folder…" so create-and-move is one flow.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { SpaceFolder } from '@/lib/spaces'
import NewFolderDialog from './NewFolderDialog'
import styles from './dashboard.module.css'

export default function MoveToFolderMenu({
  spaceId,
  sourceId,
  currentFolderId,
  folders,
}: {
  spaceId: string
  sourceId: string
  currentFolderId: string | null
  folders: SpaceFolder[]
}) {
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | 'ungrouped' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  async function assign(folderId: string | null) {
    const key = folderId ?? 'ungrouped'
    setBusyId(key)
    setError(null)
    try {
      const res = await fetch(`/api/sources/${sourceId}/folder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folderId }),
      })
      if (res.status === 401) {
        setError('Your session has expired. Please log in again.')
        return
      }
      if (!res.ok) {
        setError('Could not move this capture. Please try again.')
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function onCreated(folder: SpaceFolder) {
    setCreateOpen(false)
    await assign(folder.id)
  }

  return (
    <div
      className={`${styles.moveWrap} ${open ? styles.moveWrapOpen : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={styles.moveBtn}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setError(null)
          setOpen(value => !value)
        }}
      >
        Move
      </button>
      {open && (
        <div className={styles.moveMenu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.moveItem}
            disabled={busyId !== null || currentFolderId === null}
            onClick={() => void assign(null)}
          >
            {busyId === 'ungrouped' ? 'Moving…' : 'Ungrouped'}
          </button>
          {folders.map(folder => (
            <button
              key={folder.id}
              type="button"
              role="menuitem"
              className={styles.moveItem}
              disabled={busyId !== null || currentFolderId === folder.id}
              onClick={() => void assign(folder.id)}
            >
              {busyId === folder.id ? 'Moving…' : folder.name}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className={`${styles.moveItem} ${styles.moveItemAccent}`}
            disabled={busyId !== null}
            onClick={() => {
              setOpen(false)
              setCreateOpen(true)
            }}
          >
            New folder…
          </button>
          {error && <div className={styles.moveError}>{error}</div>}
        </div>
      )}
      <NewFolderDialog
        spaceId={spaceId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={folder => void onCreated(folder)}
      />
    </div>
  )
}
