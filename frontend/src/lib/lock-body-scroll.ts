'use client'

import { useEffect } from 'react'

/**
 * Refcounted page-scroll lock. Nested overlays share one lock so close
 * restores scrolling instead of writing back another overlay's hidden
 * overflow. iOS also needs position:fixed on body, an instant scroll
 * restore, and a wait for the visual viewport after the keyboard closes.
 */

const BODY_LOCK_PROPS = ['position', 'top', 'left', 'right', 'width'] as const
type BodyLockProp = (typeof BODY_LOCK_PROPS)[number]

interface SavedLock {
  scrollY: number
  viewportHeight: number
  body: Record<BodyLockProp, string>
}

let lockCount = 0
let saved: SavedLock | null = null
let cancelPendingRestore: (() => void) | null = null

function instantScrollTo(y: number): void {
  const html = document.documentElement
  const prev = html.style.scrollBehavior
  html.style.scrollBehavior = 'auto'
  window.scrollTo({ top: y, left: 0, behavior: 'auto' })
  html.style.scrollBehavior = prev
}

function applyLock(): void {
  const body = document.body
  const vv = window.visualViewport
  saved = {
    scrollY: window.scrollY,
    viewportHeight: vv?.height ?? window.innerHeight,
    body: {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    },
  }
  document.documentElement.dataset.scrollLock = ''
  body.style.position = 'fixed'
  body.style.top = `-${saved.scrollY}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.width = '100%'
}

function restoreLock(): void {
  const snapshot = saved
  saved = null
  delete document.documentElement.dataset.scrollLock
  if (!snapshot) return
  const body = document.body
  for (const prop of BODY_LOCK_PROPS) {
    body.style[prop] = snapshot.body[prop]
  }
  instantScrollTo(snapshot.scrollY)
}

function viewportHasSettled(lockedHeight: number): boolean {
  const current = window.visualViewport?.height ?? window.innerHeight
  return current >= lockedHeight - 8
}

function whenViewportSettled(lockedHeight: number, done: () => void): () => void {
  if (viewportHasSettled(lockedHeight)) {
    done()
    return () => {}
  }
  const vv = window.visualViewport
  let timeoutId = 0
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    vv?.removeEventListener('resize', onResize)
    window.clearTimeout(timeoutId)
    done()
  }
  const onResize = () => {
    if (viewportHasSettled(lockedHeight)) finish()
  }
  vv?.addEventListener('resize', onResize)
  timeoutId = window.setTimeout(finish, 450)
  return () => {
    if (finished) return
    finished = true
    vv?.removeEventListener('resize', onResize)
    window.clearTimeout(timeoutId)
  }
}

function blurActive(): void {
  const active = document.activeElement
  if (active instanceof HTMLElement) active.blur()
}

function forceUnlock(): void {
  cancelPendingRestore?.()
  cancelPendingRestore = null
  lockCount = 0
  if (saved || document.documentElement.hasAttribute('data-scroll-lock')) {
    restoreLock()
  }
}

export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => {}

  if (lockCount === 0) {
    if (cancelPendingRestore) {
      cancelPendingRestore()
      cancelPendingRestore = null
    } else {
      applyLock()
    }
  }
  lockCount += 1

  let released = false
  return () => {
    if (released) return
    released = true
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount > 0) return
    blurActive()
    const lockedHeight = saved?.viewportHeight ?? window.innerHeight
    cancelPendingRestore = whenViewportSettled(lockedHeight, () => {
      cancelPendingRestore = null
      if (lockCount > 0) return
      restoreLock()
    })
  }
}

export function useLockBodyScroll(active: boolean): void {
  useEffect(() => {
    if (!active) return
    return lockBodyScroll()
  }, [active])
}

if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', event => {
    if (event.persisted) forceUnlock()
  })
}
