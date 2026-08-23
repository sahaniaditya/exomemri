'use client'

/**
 * Create a folder inside a Learning Space. Native <dialog> opened with
 * showModal(), matching NewSpaceDialog so focus, Esc and the backdrop
 * come from the platform.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { SpaceFolder } from '@/lib/spaces'
import styles from './dashboard.module.css'

export default function NewFolderDialog({
  spaceId,
  open,
  onClose,
  onCreated,
}: {
  spaceId: string
  open: boolean
  onClose: () => void
  onCreated?: (folder: SpaceFolder) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()

  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function reset() {
    setName('')
    setError(null)
    setLoading(false)
  }

  function close() {
    reset()
    onClose()
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setError('Give the folder a name of at least 2 characters.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/spaces/${spaceId}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })

      if (res.status === 409) {
        setError('You already have a folder with that name in this space.')
        return
      }
      if (res.status === 401) {
        setError('Your session has expired. Please log in again.')
        return
      }
      if (!res.ok) {
        setError('Could not create the folder. Please try again.')
        return
      }

      const folder = (await res.json()) as SpaceFolder
      close()
      onCreated?.(folder)
      router.refresh()
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={event => {
        event.preventDefault()
        close()
      }}
      onClose={close}
    >
      <form className={styles.dialogForm} onSubmit={submit}>
        <h2 className={styles.dialogTitle}>New folder</h2>
        <p className={styles.dialogSub}>
          Group captures inside this space — videos in one folder, articles in another.
        </p>

        <label className={styles.dialogLabel} htmlFor="folder-name">
          Name
        </label>
        <input
          id="folder-name"
          className={styles.dialogInput}
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="Claude Code articles"
          maxLength={200}
          autoFocus
          required
        />

        {error && <div className={styles.dialogError}>{error}</div>}

        <div className={styles.dialogActions}>
          <button type="button" className={styles.dialogCancel} onClick={close}>
            Cancel
          </button>
          <button type="submit" className={styles.dialogSubmit} disabled={loading}>
            {loading ? 'Creating…' : 'Create folder'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

export function NewFolderButton({ spaceId }: { spaceId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={styles.plateAction}
        onClick={() => setOpen(true)}
      >
        New folder
      </button>
      <NewFolderDialog
        spaceId={spaceId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
