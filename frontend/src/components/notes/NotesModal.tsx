'use client'

/**
 * Accessible modal shell shared by the quick switcher, trash and link
 * pickers: overlay, `role="dialog"`, focus trap, Escape and backdrop close.
 */
import { useRef, type ReactNode } from 'react'
import { useFocusTrap } from './hooks/useFocusTrap'
import styles from './notes.module.css'

interface NotesModalProps {
  label: string
  onClose: () => void
  /** Hide the visible header (the quick switcher is just an input). */
  hideHeader?: boolean
  children: ReactNode
}

export default function NotesModal({ label, onClose, hideHeader, children }: NotesModalProps) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, true, onClose)

  return (
    <div
      className={styles.overlay}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div ref={ref} className={styles.modal} role="dialog" aria-modal="true" aria-label={label}>
        {!hideHeader && (
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>{label}</h2>
            <button type="button" className={styles.btnGhost} onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
