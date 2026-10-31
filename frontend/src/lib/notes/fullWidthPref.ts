/**
 * The "full width" reading preference for the note page, persisted in localStorage.
 * Exposed as an external store so it is safe to read during hydration.
 */
export const FULL_WIDTH_STORAGE_KEY = 'exomemri.notes.fullWidth'

const listeners = new Set<() => void>()
let memoryValue = false

export function readFullWidth(): boolean {
  try {
    const stored = window.localStorage.getItem(FULL_WIDTH_STORAGE_KEY)
    if (stored !== null) return stored === '1'
  } catch {
    // Storage can be blocked (private mode); fall back to the in-memory value.
  }
  return memoryValue
}

export function writeFullWidth(value: boolean): void {
  memoryValue = value
  try {
    window.localStorage.setItem(FULL_WIDTH_STORAGE_KEY, value ? '1' : '0')
  } catch {
    // The toggle still works for this visit through the in-memory value.
  }
  listeners.forEach(listener => listener())
}

export function subscribeFullWidth(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export const serverFullWidth = (): boolean => false
