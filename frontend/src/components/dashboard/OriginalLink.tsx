/**
 * External link to the original captured page / video.
 * Shared so feed rows, source chrome, and sidebars stay consistent.
 */
import styles from './dashboard.module.css'

interface OriginalLinkProps {
  url: string
  /** Compact icon-only control for tight chrome (sidebar). */
  compact?: boolean
  className?: string
}

export default function OriginalLink({ url, compact = false, className }: OriginalLinkProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${compact ? styles.originalLinkIcon : styles.originalLink} ${className ?? ''}`}
      title="Open original"
      aria-label="Open original source"
    >
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
        <path d="M14 5h5v5" />
        <path d="M10 14 19 5" />
        <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
      </svg>
      {compact ? null : <span className={styles.captureActionLabel}>Original</span>}
    </a>
  )
}
