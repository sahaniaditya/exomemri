'use client'

/**
 * The "+" tile in the spaces grid. Client-only so SpacesGrid can stay a server
 * component and keep rendering real space data.
 */
import { useState } from 'react'

import styles from './dashboard.module.css'
import NewSpaceDialog from './NewSpaceDialog'

export default function NewSpaceTile() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={`${styles.space} ${styles.newspace}`}
        onClick={() => setOpen(true)}
      >
        <div className={styles.plus}>+</div>
        <div className={styles.nsTitle}>New Learning Space</div>
        <div className={styles.nsSub}>Start with a goal, not a blank page</div>
      </button>

      <NewSpaceDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
