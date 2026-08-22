'use client'
import { useState } from 'react'
import styles from './dashboard.module.css'
import type { Collaborator } from '@/lib/sharing'

interface ShareManagerProps {
  spaceId: string
  initialCollaborators: Collaborator[]
}

export default function ShareManager({ spaceId, initialCollaborators }: ShareManagerProps) {
  const [collaborators, setCollaborators] = useState(initialCollaborators)
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInvite = async () => {
    const clean = username.trim().toLowerCase()
    if (!clean || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/spaces/${spaceId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: clean }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error?.message ?? data.detail ?? 'Could not share this space.')
        return
      }
      setCollaborators(prev =>
        prev.some(c => c.user_id === data.user_id) ? prev : [...prev, data]
      )
      setUsername('')
    } catch {
      setError('Could not share this space. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleRevoke = async (userId: string) => {
    try {
      await fetch(`/api/spaces/${spaceId}/collaborators/${userId}`, { method: 'DELETE' })
      setCollaborators(prev => prev.filter(c => c.user_id !== userId))
    } catch {
      setError('Could not remove that person. Please try again.')
    }
  }

  return (
    <div className={styles.rcard}>
      <div className={styles.chatinputbar}>
        <input
          className={styles.chatinput}
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleInvite()
            }
          }}
          placeholder="Atlas username to share read-only access with"
          disabled={busy}
        />
        <button
          type="button"
          className={styles.chatsend}
          onClick={handleInvite}
          disabled={busy || !username.trim()}
          aria-label="Share"
        >
          Share
        </button>
      </div>
      {error && <p className={styles.covempty}>{error}</p>}

      {collaborators.length > 0 && (
        <div className={styles.covsection}>
          <div className={styles.covsectiontitle}>Can view this space</div>
          <div className={styles.covchips}>
            {collaborators.map(c => (
              <span key={c.user_id} className={styles.covchip}>
                {c.full_name ?? c.username}
                <button
                  type="button"
                  className={styles.covchipremove}
                  onClick={() => handleRevoke(c.user_id)}
                  aria-label={`Stop sharing with ${c.username}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
