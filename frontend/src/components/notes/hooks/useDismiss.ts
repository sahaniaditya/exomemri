import { useEffect, type RefObject } from 'react'

/** Call `onClose` on Escape or a pointer press outside `ref` while `active`. */
export function useDismiss(ref: RefObject<HTMLElement | null>, active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, active, onClose])
}
