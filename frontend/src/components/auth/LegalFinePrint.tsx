'use client'

import { useState } from 'react'

import type { LegalDocKind } from '@/components/auth/legal-content'
import LegalModal from '@/components/auth/LegalModal'
import styles from './auth.module.css'

/** Signup fine-print that opens Terms / Privacy in a modal. */
export default function LegalFinePrint() {
  const [doc, setDoc] = useState<LegalDocKind | null>(null)

  return (
    <>
      <p className={styles.finePrint}>
        By signing up you agree to our{' '}
        <button
          type="button"
          className={styles.finePrintLink}
          onClick={() => setDoc('terms')}
        >
          Terms
        </button>{' '}
        and{' '}
        <button
          type="button"
          className={styles.finePrintLink}
          onClick={() => setDoc('privacy')}
        >
          Privacy Policy
        </button>
        .
      </p>
      <LegalModal kind={doc} open={doc !== null} onClose={() => setDoc(null)} />
    </>
  )
}
