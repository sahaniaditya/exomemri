'use client'

/**
 * Shared dashboard sidebar shell. Desktop keeps the full sticky column;
 * mobile collapses to a brand bar + hamburger that opens a slide-over drawer.
 * Optional `account` chrome is shown in the drawer beside the menus on mobile.
 */
import { useEffect, useId, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lockup } from '@/components/brand/Lockup'
import { useLockBodyScroll } from '@/lib/lock-body-scroll'
import styles from './dashboard.module.css'

interface SideChromeProps {
  children: ReactNode
  account?: ReactNode
}

export default function SideChrome({ children, account }: SideChromeProps) {
  const pathname = usePathname()
  // Remount on navigation so the drawer always starts closed without an effect.
  return (
    <SideChromeDrawer key={pathname} account={account}>
      {children}
    </SideChromeDrawer>
  )
}

const MOBILE_MQ = '(max-width: 760px)'

function SideChromeDrawer({ children, account }: SideChromeProps) {
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const panelId = useId()
  useLockBodyScroll(open && isMobile)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const sync = () => {
      setIsMobile(mq.matches)
      if (!mq.matches) setOpen(false)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <aside className={`${styles.side} ${open ? styles.sideOpen : ''}`}>
      <div className={styles.sideMobileBar}>
        <Link className={styles.brand} href="/dashboard">
          <Lockup size={24} />
        </Link>
        <div className={styles.sideMobileBarEnd}>
          {account ? <div className={styles.sideMobileAccount}>{account}</div> : null}
          <button
            type="button"
            className={styles.sideMenuBtn}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen(value => !value)}
          >
            {open ? (
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <button
        type="button"
        className={styles.sideBackdrop}
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      <div id={panelId} className={styles.sidePanel}>
        <Link className={`${styles.brand} ${styles.sideDesktopBrand}`} href="/dashboard">
          <Lockup size={24} />
        </Link>
        {children}
        {account ? <div className={styles.sideAccount}>{account}</div> : null}
      </div>
    </aside>
  )
}
