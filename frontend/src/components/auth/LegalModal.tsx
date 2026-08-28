'use client'

import { useEffect, useRef } from 'react'

import {
  getLegalDocument,
  type LegalDocKind,
} from '@/components/auth/legal-content'
import styles from './auth.module.css'

export default function LegalModal({
  kind,
  open,
  onClose,
}: {
  kind: LegalDocKind | null
  open: boolean
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const doc = kind ? getLegalDocument(kind) : null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  if (!open || !doc) return null

  return (
    <dialog
      ref={dialogRef}
      className={styles.legalDialog}
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
      onClose={onClose}
    >
      <div className={styles.legalHeader}>
        <div>
          <h2 className={styles.legalTitle} id="legal-dialog-title">
            {doc.title}
          </h2>
          <p className={styles.legalUpdated}>Last updated {doc.updated}</p>
        </div>
        <button
          type="button"
          className={styles.legalClose}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className={styles.legalBody} aria-labelledby="legal-dialog-title">
        <p className={styles.legalIntro}>{doc.intro}</p>
        {doc.sections.map(section => (
          <section key={section.heading} className={styles.legalSection}>
            <h3 className={styles.legalHeading}>{section.heading}</h3>
            {section.paragraphs.map(paragraph => (
              <p key={paragraph.slice(0, 48)} className={styles.legalParagraph}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <div className={styles.legalFooter}>
        <button type="button" className={styles.legalDone} onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  )
}
