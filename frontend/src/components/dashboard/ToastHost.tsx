'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { TOAST_EVENT, type ToastDetail, type ToastVariant } from '@/lib/toast'
import { useIsMounted } from '@/lib/use-is-mounted'
import styles from './dashboard.module.css'

const DISMISS_MS = 5000

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

export default function ToastHost() {
  const mounted = useIsMounted()
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const timers = new Map<number, number>()

    function dismiss(id: number) {
      const timer = timers.get(id)
      if (timer !== undefined) {
        window.clearTimeout(timer)
        timers.delete(id)
      }
      setToasts(prev => prev.filter(toast => toast.id !== id))
    }

    function onToast(event: Event) {
      const { message, variant = 'error' } = (event as CustomEvent<ToastDetail>).detail
      if (!message) return
      const id = Date.now() + Math.random()
      setToasts(prev => [...prev, { id, message, variant }])
      timers.set(
        id,
        window.setTimeout(() => dismiss(id), DISMISS_MS)
      )
    }

    window.addEventListener(TOAST_EVENT, onToast)
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast)
      for (const timer of timers.values()) window.clearTimeout(timer)
    }
  }, [])

  if (!mounted || toasts.length === 0) return null

  return createPortal(
    <div className={styles.toastStack} aria-live="polite" aria-relevant="additions">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`${styles.toast} ${toast.variant === 'error' ? styles.toastError : ''}`}
          role="status"
        >
          <p className={styles.toastMsg}>{toast.message}</p>
          <button
            type="button"
            className={styles.toastDismiss}
            aria-label="Dismiss"
            onClick={() =>
              setToasts(prev => prev.filter(item => item.id !== toast.id))
            }
          >
            ×
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
