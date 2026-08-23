import type { ReactNode } from 'react'
import Link from 'next/link'

import styles from './dashboard.module.css'

interface PlateProps {
  num: string
  title: string
  link?: { label: string; href: string }
  action?: ReactNode
}

/** Numbered section header — "01 · Continue where you left off ————". */
export default function Plate({ num, title, link, action }: PlateProps) {
  return (
    <div className={styles.plate}>
      <span className={styles.platenum}>{num}</span>
      <span className={styles.platetitle}>{title}</span>
      <span className={styles.plateline} />
      {action}
      {link && (
        <Link className={styles.platelink} href={link.href}>
          {link.label}
        </Link>
      )}
    </div>
  )
}
