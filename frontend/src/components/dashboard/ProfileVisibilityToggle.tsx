'use client'
import { useState } from 'react'
import { useIsMounted } from '@/lib/use-is-mounted'
import styles from './dashboard.module.css'

interface ProfileVisibilityToggleProps {
  username: string
  initialPublic: boolean
}

export default function ProfileVisibilityToggle({
  username,
  initialPublic,
}: ProfileVisibilityToggleProps) {
  const [isPublic, setIsPublic] = useState(initialPublic)
  const [busy, setBusy] = useState(false)
  const mounted = useIsMounted()
  const profilePath = `/u/${username}`
  const profileLabel = mounted
    ? `${window.location.host}${profilePath}`
    : profilePath

  const handleToggle = async () => {
    const next = !isPublic
    setBusy(true)
    try {
      const res = await fetch('/api/profile/visibility', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_public: next }),
      })
      if (!res.ok) throw new Error(`status ${res.status}`)
      setIsPublic(next)
    } catch (error) {
      console.error('Failed to update profile visibility:', error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.rcard}>
      <div className={styles.covhead}>
        <div className={styles.covlabel}>Public learning profile</div>
      </div>
      <p className={styles.covempty}>
        {isPublic
          ? `Anyone with the link can see what you've captured and mastered.`
          : `Private — only you can see this. Turn it on to get a shareable link.`}
      </p>
      <button type="button" className={styles.railbtn} onClick={handleToggle} disabled={busy}>
        {isPublic ? 'Make private' : 'Make public'}
      </button>
      {isPublic && (
        <p className={styles.planrationale}>
          Your profile:{' '}
          <a href={profilePath}>{profileLabel}</a>
        </p>
      )}
    </div>
  )
}
