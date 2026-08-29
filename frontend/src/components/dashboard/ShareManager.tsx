'use client'

/**
 * Invite by username or enable a shareable link. Native <dialog> opened with
 * showModal(), matching NewSpaceDialog so focus, Esc and the backdrop
 * come from the platform.
 */
import { useEffect, useRef, useState } from 'react'
import styles from './dashboard.module.css'
import type { Collaborator, ShareLinkStatus } from '@/lib/sharing'

interface ShareManagerProps {
  sourceId: string
  initialCollaborators: Collaborator[]
  initialShareLink?: ShareLinkStatus
  open: boolean
  onClose: () => void
}

function inviteErrorMessage(status: number, data: unknown): string {
  const envelope = data as { error?: { message?: string }; detail?: string }
  if (status === 401) return 'Your session has expired. Please log in again.'
  if (status === 409) return 'This capture is already shared with them.'
  return envelope.error?.message ?? envelope.detail ?? 'Could not share this capture.'
}

function shareUrlForToken(token: string): string {
  if (typeof window === 'undefined') return `/s/${token}`
  return `${window.location.origin}/s/${token}`
}

export default function ShareManager({
  sourceId,
  initialCollaborators,
  initialShareLink = { enabled: false, token: null, path: null, created_at: null },
  open,
  onClose,
}: ShareManagerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [collaborators, setCollaborators] = useState(initialCollaborators)
  const [shareLink, setShareLink] = useState(initialShareLink)
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)
  const [copied, setCopied] = useState(false)
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
    setLinkBusy(false)
    setCopied(false)
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

  async function enableLink() {
    if (linkBusy) return
    setLinkBusy(true)
    setError(null)
    setCopied(false)
    try {
      const res = await fetch(`/api/sources/${sourceId}/share-link`, { method: 'PUT' })
      const data: unknown = await res.json()
      if (!res.ok) {
        setError('Could not create a shareable link. Please try again.')
        return
      }
      const link = data as { token: string; path: string; created_at: string }
      setShareLink({
        enabled: true,
        token: link.token,
        path: link.path,
        created_at: link.created_at,
      })
    } catch {
      setError('Could not create a shareable link. Please try again.')
    } finally {
      setLinkBusy(false)
    }
  }

  async function copyLink() {
    if (!shareLink.token) return
    try {
      await navigator.clipboard.writeText(shareUrlForToken(shareLink.token))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy the link. Please copy it manually.')
    }
  }

  async function turnOffLink() {
    if (linkBusy) return
    setLinkBusy(true)
    setError(null)
    setCopied(false)
    try {
      const res = await fetch(`/api/sources/${sourceId}/share-link`, { method: 'DELETE' })
      if (!res.ok) {
        setError('Could not turn off the link. Please try again.')
        return
      }
      setShareLink({ enabled: false, token: null, path: null, created_at: null })
    } catch {
      setError('Could not turn off the link. Please try again.')
    } finally {
      setLinkBusy(false)
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

        <div className={styles.dialogPeople}>
          <div className={styles.covsectiontitle}>Shareable link</div>
          <p className={styles.shareLinkHint}>
            Any logged-in exomemri user with the link can view. Turning it off
            stops new joins — people who already opened it keep access until
            you remove them below.
          </p>
          {shareLink.enabled && shareLink.token ? (
            <div className={styles.shareLinkRow}>
              <input
                className={styles.dialogInput}
                value={shareUrlForToken(shareLink.token)}
                readOnly
                aria-label="Shareable link"
                onFocus={event => event.currentTarget.select()}
              />
              <button
                type="button"
                className={styles.dialogCancel}
                onClick={() => void copyLink()}
                disabled={linkBusy}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                className={styles.dialogCancel}
                onClick={() => void turnOffLink()}
                disabled={linkBusy}
              >
                {linkBusy ? '…' : 'Turn off'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.dialogCancel}
              onClick={() => void enableLink()}
              disabled={linkBusy}
            >
              {linkBusy ? 'Creating…' : 'Enable link'}
            </button>
          )}
        </div>

        <label className={styles.dialogLabel} htmlFor="share-username">
          Or invite by username
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
            Done
          </button>
          <button
            type="submit"
            className={styles.dialogSubmit}
            disabled={busy || username.trim().length < 3}
          >
            {busy ? 'Sharing…' : 'Invite'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
