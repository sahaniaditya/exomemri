'use client'

/**
 * Owner-only delete for a capture. Confirms, then either refreshes the
 * current list or navigates away from the now-gone detail page.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './dashboard.module.css'

export default function DeleteCaptureButton({
  sourceId,
  title,
  redirectTo,
  variant = 'row',
}: {
  sourceId: string
  title: string
  redirectTo?: string
  variant?: 'row' | 'hero'
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function remove() {
    const ok = window.confirm(
      `Delete “${title}”? Notes, chat, and files for this capture are removed permanently.`
    )
    if (!ok) return
    setBusy(true)
    try {
      const res = await fetch(`/api/sources/${sourceId}`, { method: 'DELETE' })
      if (res.status === 401) {
        window.alert('Your session has expired. Please log in again.')
        return
      }
      if (!res.ok && res.status !== 204) {
        window.alert('Could not delete this capture. Please try again.')
        return
      }
      if (redirectTo) router.push(redirectTo)
      else router.refresh()
    } catch {
      window.alert('Could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const className =
    variant === 'hero' ? styles.captureDeleteBtn : styles.srcDelete

  const label = busy ? `Deleting ${title}` : `Delete ${title}`

  return (
    <button
      type="button"
      className={className}
      onClick={() => void remove()}
      disabled={busy}
      aria-label={label}
      title="Delete"
    >
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
        <path d="M5 7h14" />
        <path d="M9 7V5h6v2" />
        <path d="M8 7l1 13h6l1-13" />
      </svg>
      {variant === 'hero' ? (
        <span className={styles.captureActionLabel}>{busy ? 'Deleting…' : 'Delete'}</span>
      ) : null}
    </button>
  )
}
