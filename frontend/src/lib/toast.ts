/**
 * Lightweight toasts for dashboard client components.
 *
 * Dispatched on `window` so any mounted `ToastHost` can render them — same
 * reason the session bridge uses a custom event instead of a React context.
 */
export const TOAST_EVENT = 'atlas:toast'

export type ToastVariant = 'error' | 'info'

export interface ToastDetail {
  message: string
  variant?: ToastVariant
}

export function showToast(message: string, variant: ToastVariant = 'error'): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, variant } })
  )
}
