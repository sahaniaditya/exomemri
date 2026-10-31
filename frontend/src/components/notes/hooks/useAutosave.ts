'use client'

/**
 * Autosave state machine for a full-page note.
 *
 *   idle -> dirty -> saving -> saved
 *                       |-> error    (retry with backoff; 401 never retries)
 *                       |-> conflict (409; resolved by keepMine() or a reload)
 *
 * Guarantees: one request in flight at a time (edits made meanwhile queue exactly one
 * follow-up), `expected_updated_at` chained from each response, a debounce plus a max
 * wait while typing, and a best-effort flush when the tab is blurred, hidden or closed.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { NotePage } from '@/lib/notes'

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict'
export type AutosaveField = 'title' | 'content'

export const AUTOSAVE_DEBOUNCE_MS = 1500
export const AUTOSAVE_MAX_WAIT_MS = 10_000
export const AUTOSAVE_BACKOFF_MS = [2000, 4000, 8000, 16_000, 30_000]
export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.'
export const SAVE_FAILED_MESSAGE = 'Couldn’t save — retrying.'

export interface AutosaveOptions {
  /** BFF route of the note, e.g. `/api/spaces/{id}/notes/{noteId}`. */
  endpoint: string
  /** `updated_at` of the note as last loaded from the server. */
  initialUpdatedAt: string | null
  /** Current value of a field at send time; `undefined` skips the field. */
  read: (field: AutosaveField) => unknown
  onSaved?: (page: NotePage) => void
  debounceMs?: number
  maxWaitMs?: number
}

export interface AutosaveApi {
  status: AutosaveStatus
  lastSavedAt: string | null
  errorMessage: string | null
  /** The server's current `updated_at` when a conflict was reported. */
  conflictUpdatedAt: string | null
  markDirty: (field: AutosaveField) => void
  flush: () => void
  retry: () => void
  /** Resend the local version, ignoring the server's newer one. */
  keepMine: () => void
}

type SaveOutcome = 'ok' | 'conflict' | 'auth' | 'failed'

function backoffDelay(attempt: number): number {
  return AUTOSAVE_BACKOFF_MS[Math.min(attempt, AUTOSAVE_BACKOFF_MS.length) - 1]
}

export function useAutosave(options: AutosaveOptions): AutosaveApi {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(options.initialUpdatedAt)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [conflictUpdatedAt, setConflictUpdatedAt] = useState<string | null>(null)

  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const aliveRef = useRef(true)
  const statusRef = useRef<AutosaveStatus>('idle')
  const dirtyRef = useRef<Set<AutosaveField>>(new Set())
  const expectedRef = useRef<string | null>(options.initialUpdatedAt)
  const ignoreExpectedRef = useRef(false)
  const inFlightRef = useRef(false)
  const queuedRef = useRef(false)
  const attemptsRef = useRef(0)
  const authFailedRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef<(opts?: { keepalive?: boolean }) => void>(() => {})

  const updateStatus = useCallback((next: AutosaveStatus) => {
    statusRef.current = next
    if (aliveRef.current) setStatus(next)
  }, [])

  const clearTimers = useCallback(() => {
    for (const ref of [debounceRef, maxWaitRef, retryRef]) {
      if (ref.current !== null) clearTimeout(ref.current)
      ref.current = null
    }
  }, [])

  const send = useCallback(
    async (
      payload: Record<string, unknown>,
      keepalive: boolean
    ): Promise<{ outcome: SaveOutcome; page?: NotePage; serverUpdatedAt?: string | null }> => {
      try {
        const res = await fetch(optionsRef.current.endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          ...(keepalive ? { keepalive: true } : {}),
        })
        if (res.status === 401) return { outcome: 'auth' }
        if (res.status === 409) {
          let serverUpdatedAt: string | null = null
          try {
            const body = (await res.json()) as {
              error?: { code?: string; detail?: { updated_at?: string | null } }
            }
            serverUpdatedAt = body.error?.detail?.updated_at ?? null
          } catch {
            // Body is optional; the conflict itself is what matters.
          }
          return { outcome: 'conflict', serverUpdatedAt }
        }
        if (!res.ok) return { outcome: 'failed' }
        return { outcome: 'ok', page: (await res.json()) as NotePage }
      } catch {
        return { outcome: 'failed' }
      }
    },
    []
  )

  const save = useCallback(
    (opts: { keepalive?: boolean } = {}) => {
      if (inFlightRef.current) {
        queuedRef.current = true
        return
      }
      if (statusRef.current === 'conflict' && !ignoreExpectedRef.current) return
      if (dirtyRef.current.size === 0) return
      clearTimers()

      const sent = new Set(dirtyRef.current)
      const payload: Record<string, unknown> = {}
      for (const field of sent) {
        const value = optionsRef.current.read(field)
        if (value !== undefined) payload[field] = value
      }
      dirtyRef.current.clear()
      if (Object.keys(payload).length === 0) {
        updateStatus(attemptsRef.current > 0 ? 'error' : 'saved')
        return
      }
      if (!ignoreExpectedRef.current && expectedRef.current) {
        payload.expected_updated_at = expectedRef.current
      }

      inFlightRef.current = true
      queuedRef.current = false
      updateStatus('saving')
      setErrorMessage(null)

      void send(payload, Boolean(opts.keepalive)).then(result => {
        inFlightRef.current = false
        if (result.outcome === 'ok' && result.page) {
          attemptsRef.current = 0
          authFailedRef.current = false
          ignoreExpectedRef.current = false
          expectedRef.current = result.page.updated_at ?? expectedRef.current
          if (aliveRef.current) {
            setLastSavedAt(result.page.updated_at ?? new Date().toISOString())
            setConflictUpdatedAt(null)
          }
          optionsRef.current.onSaved?.(result.page)
          if (queuedRef.current && dirtyRef.current.size > 0) {
            queuedRef.current = false
            updateStatus('dirty')
            saveRef.current()
          } else {
            queuedRef.current = false
            updateStatus(dirtyRef.current.size > 0 ? 'dirty' : 'saved')
          }
          return
        }

        // Nothing was persisted: put the fields back so a later attempt resends them.
        sent.forEach(field => dirtyRef.current.add(field))
        queuedRef.current = false
        if (result.outcome === 'conflict') {
          if (aliveRef.current) setConflictUpdatedAt(result.serverUpdatedAt ?? null)
          updateStatus('conflict')
          return
        }
        if (result.outcome === 'auth') {
          authFailedRef.current = true
          if (aliveRef.current) setErrorMessage(SESSION_EXPIRED_MESSAGE)
          updateStatus('error')
          return
        }
        attemptsRef.current += 1
        if (aliveRef.current) setErrorMessage(SAVE_FAILED_MESSAGE)
        updateStatus('error')
        if (aliveRef.current) {
          retryRef.current = setTimeout(() => {
            retryRef.current = null
            saveRef.current()
          }, backoffDelay(attemptsRef.current))
        }
      })
    },
    [clearTimers, send, updateStatus]
  )

  useEffect(() => {
    saveRef.current = save
  }, [save])

  const markDirty = useCallback(
    (field: AutosaveField) => {
      dirtyRef.current.add(field)
      if (statusRef.current === 'conflict') return
      // A new edit supersedes a pending backoff retry; the debounce below saves it.
      if (retryRef.current !== null) {
        clearTimeout(retryRef.current)
        retryRef.current = null
      }
      if (statusRef.current !== 'saving') updateStatus('dirty')
      const { debounceMs = AUTOSAVE_DEBOUNCE_MS, maxWaitMs = AUTOSAVE_MAX_WAIT_MS } =
        optionsRef.current
      if (debounceRef.current !== null) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        saveRef.current()
      }, debounceMs)
      if (maxWaitRef.current === null) {
        maxWaitRef.current = setTimeout(() => {
          maxWaitRef.current = null
          saveRef.current()
        }, maxWaitMs)
      }
    },
    [updateStatus]
  )

  const flush = useCallback((keepalive = false) => {
    if (authFailedRef.current || statusRef.current === 'conflict') return
    saveRef.current({ keepalive })
  }, [])

  const flushNow = useCallback(() => flush(false), [flush])

  const retry = useCallback(() => {
    authFailedRef.current = false
    clearTimers()
    saveRef.current()
  }, [clearTimers])

  const keepMine = useCallback(() => {
    ignoreExpectedRef.current = true
    // Make sure both fields are resent, even if only one triggered the conflict.
    dirtyRef.current.add('content')
    dirtyRef.current.add('title')
    updateStatus('dirty')
    saveRef.current()
  }, [updateStatus])

  useEffect(() => {
    aliveRef.current = true
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush(true)
    }
    const onPageHide = () => flush(true)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      // Leaving the page (client navigation) must not drop pending edits.
      flush(true)
      aliveRef.current = false
      clearTimers()
    }
  }, [clearTimers, flush])

  return {
    status,
    lastSavedAt,
    errorMessage,
    conflictUpdatedAt,
    markDirty,
    flush: flushNow,
    retry,
    keepMine,
  }
}
