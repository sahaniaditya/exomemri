'use client'

/**
 * Create a Learning Space. The tile that opens this is the entry point for the
 * whole capture flow — the extension can only save into a space that exists.
 *
 * A native <dialog> opened with showModal(), so focus trapping, Esc and the
 * backdrop come from the platform rather than from a dependency.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { refreshExtensionSession } from '@/lib/extension-session'
import styles from './dashboard.module.css'

export default function NewSpaceDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()

  const [name, setName] = useState('')
  const [goalText, setGoalText] = useState('')
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
    setGoalText('')
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
      setError('Give your space a name of at least 2 characters.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          goal_text: goalText.trim() || null,
        }),
      })

      if (res.status === 409) {
        setError('You already have a Learning Space with that name.')
        return
      }
      if (res.status === 401) {
        setError('Your session has expired. Please log in again.')
        return
      }
      if (!res.ok) {
        setError('Could not create the space. Please try again.')
        return
      }

      // The first space a user creates becomes their active one, so the
      // extension's mirrored session is now stale. Refresh it before we finish
      // — that write notifies the bridge, which is what lets the popup offer
      // this space without the user reloading the page.
      await refreshExtensionSession()

      close()
      // Re-fetch the server component so the new tile appears.
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
      // Esc and the backdrop close the dialog without going through our button.
      onCancel={event => {
        event.preventDefault()
        close()
      }}
      onClose={close}
    >
      <form className={styles.dialogForm} onSubmit={submit}>
        <h2 className={styles.dialogTitle}>New Learning Space</h2>
        <p className={styles.dialogSub}>
          Everything you capture goes into a space. Name it after what you&apos;re learning.
        </p>

        <label className={styles.dialogLabel} htmlFor="space-name">
          Name
        </label>
        <input
          id="space-name"
          className={styles.dialogInput}
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="Claude Code"
          maxLength={200}
          autoFocus
          required
        />

        <label className={styles.dialogLabel} htmlFor="space-goal">
          Goal (optional)
        </label>
        <textarea
          id="space-goal"
          className={styles.dialogTextarea}
          value={goalText}
          onChange={event => setGoalText(event.target.value)}
          placeholder="What do you want to be able to do by the end?"
          maxLength={2000}
        />

        {error && <div className={styles.dialogError}>{error}</div>}

        <div className={styles.dialogActions}>
          <button type="button" className={styles.dialogCancel} onClick={close}>
            Cancel
          </button>
          <button type="submit" className={styles.dialogSubmit} disabled={loading}>
            {loading ? 'Creating…' : 'Create space'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
