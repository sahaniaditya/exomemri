'use client'

/**
 * Invite someone to view this capture. Native <dialog> opened with
 * showModal(), matching NewSpaceDialog so focus, Esc and the backdrop
 * come from the platform.
 */
import { useEffect, useRef, useState } from 'react'
import styles from './dashboard.module.css'
import type { Collaborator } from '@/lib/sharing'

interface ShareManagerProps {
  sourceId: string
  initialCollaborators: Collaborator[]
  open: boolean
  onClose: () => void
}

function inviteErrorMessage(status: number, data: unknown): string {
  const envelope = data as { error?: { message?: string }; detail?: string }
  if (status === 401) return 'Your session has expired. Please log in again.'
  if (status === 404) return 'No exomemri user with that username.'
  if (status === 409) return 'This capture is already shared with them.'
  return envelope.error?.message ?? envelope.detail ?? 'Could not share this capture.'
}

export default function ShareManager({
  sourceId,
  initialCollaborators,
  open,
  onClose,
}: ShareManagerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [collaborators, setCollaborators] = useState(initialCollaborators)
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function reset() {
    setUsername('')
    setError(null)
    setBusy(false)
  }

  function close() {
    reset()
    onClose()
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const clean = username.trim().toLowerCase()
    if (clean.length < 3 || busy) return

    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/sources/${sourceId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: clean }),
      })
      const data: unknown = await res.json()
      if (!res.ok) {
        setError(inviteErrorMessage(res.status, data))
        return
      }
      const invited = data as Collaborator
      setCollaborators(prev =>
        prev.some(c => c.user_id === invited.user_id) ? prev : [...prev, invited]
      )
      setUsername('')
    } catch {
      setError('Could not share this capture. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRevoke(userId: string) {
    try {
      const res = await fetch(`/api/sources/${sourceId}/collaborators/${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        setError('Could not remove that person. Please try again.')
        return
      }
      setCollaborators(prev => prev.filter(c => c.user_id !== userId))
    } catch {
      setError('Could not remove that person. Please try again.')
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
        <h2 className={styles.dialogTitle}>Share this capture</h2>
        <p className={styles.dialogSub}>
          They&apos;ll get read-only access to the summary and notes. Chat and
          the rest of the space stay yours.
        </p>

        <label className={styles.dialogLabel} htmlFor="share-username">
          exomemri username
        </label>
        <input
          id="share-username"
          className={styles.dialogInput}
          value={username}
          onChange={event => setUsername(event.target.value)}
          placeholder="their-username"
          autoComplete="off"
          spellCheck={false}
          minLength={3}
          maxLength={32}
          autoFocus
          required
          disabled={busy}
        />

        {error ? <div className={styles.dialogError}>{error}</div> : null}

        {collaborators.length > 0 ? (
          <div className={styles.dialogPeople}>
            <div className={styles.covsectiontitle}>Can view this capture</div>
            <div className={styles.covchips}>
              {collaborators.map(c => (
                <span key={c.user_id} className={styles.covchip}>
                  {c.full_name ?? c.username}
                  <button
                    type="button"
                    className={styles.covchipremove}
                    onClick={() => void handleRevoke(c.user_id)}
                    aria-label={`Stop sharing with ${c.username}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className={styles.dialogActions}>
          <button type="button" className={styles.dialogCancel} onClick={close}>
            Cancel
          </button>
          <button
            type="submit"
            className={styles.dialogSubmit}
            disabled={busy || username.trim().length < 3}
          >
            {busy ? 'Sharing…' : 'Share'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
