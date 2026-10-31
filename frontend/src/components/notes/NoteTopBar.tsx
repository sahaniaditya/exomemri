'use client'

import Link from 'next/link'
import styles from './notes.module.css'

interface NoteTopBarProps {
  spaceId: string
  spaceName: string
  title: string
  statusText: string
  statusTone: 'neutral' | 'error'
  /** Shown next to the status when a failed save can be retried by hand. */
  onRetry?: () => void
  fullWidth: boolean
  onToggleFullWidth: () => void
}

export default function NoteTopBar({
  spaceId,
  spaceName,
  title,
  statusText,
  statusTone,
  onRetry,
  fullWidth,
  onToggleFullWidth,
}: NoteTopBarProps) {
  return (
    <header className={styles.topbar}>
      <Link href={`/dashboard/spaces/${spaceId}#space-notes`} className={styles.back}>
        <span aria-hidden="true">←</span> Back to space
      </Link>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link href={`/dashboard/spaces/${spaceId}`} className={styles.crumbLink}>
          {spaceName}
        </Link>
        <span aria-hidden="true">/</span>
        <span className={styles.crumbCurrent}>{title.trim() || 'Untitled'}</span>
      </nav>
      <div className={styles.topbarSpacer} />
      <span
        className={styles.status}
        data-tone={statusTone}
        role="status"
        aria-live="polite"
        data-testid="save-status"
      >
        {statusText}
      </span>
      {onRetry ? (
        <button type="button" className={styles.linkBtn} onClick={onRetry}>
          Retry
        </button>
      ) : null}
      <button
        type="button"
        className={styles.widthToggle}
        aria-pressed={fullWidth}
        onClick={onToggleFullWidth}
      >
        {fullWidth ? 'Narrow' : 'Full width'}
      </button>
    </header>
  )
}
