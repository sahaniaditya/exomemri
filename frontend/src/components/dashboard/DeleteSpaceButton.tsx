'use client'

/**
 * Owner-only delete for a Learning Space. Confirms, then returns to overview
 * and refreshes the extension session so the popup drops a deleted active space.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { refreshExtensionSession } from '@/lib/extension-session'
import styles from './dashboard.module.css'

export default function DeleteSpaceButton({
  spaceId,
  name,
}: {
  spaceId: string
  name: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function remove() {
    const ok = window.confirm(
      `Delete “${name}”? Captures, notes, the knowledge map, and files in this space are removed permanently.`
    )
    if (!ok) return
    setBusy(true)
    try {
      const res = await fetch(`/api/spaces/${spaceId}`, { method: 'DELETE' })
      if (res.status === 401) {
        window.alert('Your session has expired. Please log in again.')
        return
      }
      if (!res.ok && res.status !== 204) {
        window.alert('Could not delete this space. Please try again.')
        return
      }
      await refreshExtensionSession()
      router.push('/dashboard')
    } catch {
      window.alert('Could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const label = busy ? `Deleting ${name}` : `Delete ${name}`

  return (
    <button
      type="button"
      className={styles.spaceDeleteBtn}
      onClick={() => void remove()}
      disabled={busy}
      aria-label={label}
      title="Delete space"
    >
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
        <path d="M5 7h14" />
        <path d="M9 7V5h6v2" />
        <path d="M8 7l1 13h6l1-13" />
      </svg>
      <span>{busy ? 'Deleting…' : 'Delete space'}</span>
    </button>
  )
}
