'use client'

import { useEffect } from 'react'

/**
 * Refcounted page-scroll lock. Nested overlays must share one lock so
 * close restores scrolling instead of writing back another overlay's
 * `overflow: hidden`. iOS needs position:fixed on body or the visual
 * viewport keeps the page frozen after the overlay unmounts.
 */
let lockCount = 0
let savedScrollY = 0

export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => {}

  if (lockCount === 0) {
    savedScrollY = window.scrollY
    document.documentElement.dataset.scrollLock = ''
    document.body.style.position = 'fixed'
    document.body.style.top = `-${savedScrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
  }
  lockCount += 1

  let released = false
  return () => {
    if (released) return
    released = true
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount > 0) return
    delete document.documentElement.dataset.scrollLock
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    document.body.style.width = ''
    const y = savedScrollY
    window.requestAnimationFrame(() => window.scrollTo(0, y))
  }
}

export function useLockBodyScroll(active: boolean): void {
  useEffect(() => {
    if (!active) return
    return lockBodyScroll()
  }, [active])
}
