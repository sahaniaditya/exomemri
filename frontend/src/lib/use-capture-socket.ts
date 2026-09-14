'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { CapturedSource } from '@/lib/dashboard-data'

const supabase = createClient()

export type CaptureStatusEvent = {
  sourceId: string
  patch: Partial<CapturedSource>
}

function toUiStatus(dbStatus: string): CapturedSource['status'] {
  switch (dbStatus) {
    case 'ready':
      return 'ready'
    case 'failed':
      return 'failed'
    case 'queued':
    case 'fetching':
    case 'chunking':
    case 'embedding':
    case 'summarizing':
    case 'extracting':
    default:
      return 'processing'
  }
}

export function useCaptureSocket(
  spaceIds: string[],
  onStatus: (event: CaptureStatusEvent) => void
) {
  const onStatusRef = useRef(onStatus)
  onStatusRef.current = onStatus

  // Create a stable dependency key
  const key = spaceIds.filter(Boolean).sort().join(',')

  useEffect(() => {
    console.log('[useCaptureSocket] Running effect with key:', key)
    if (!key) {
      console.warn('[useCaptureSocket] Empty spaceIds key; skipping socket subscription.')
      return
    }

    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    const filter =
      spaceIds.length === 1
        ? `space_id=eq.${spaceIds[0]}`
        : `space_id=in.(${spaceIds.join(',')})`

    async function initSubscription() {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (cancelled) return

      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }

      console.log('[useCaptureSocket] Subscribing to filter:', filter)

      channel = supabase
        .channel(`sources-status-${key}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'sources',
            filter,
          },
          payload => {
            console.log('[Realtime Event Received]:', payload)
            const row = payload.new as Record<string, unknown>
            if (row?.id) {
              onStatusRef.current({
                sourceId: row.id as string,
                patch: {
                  status: toUiStatus(row.processing_status as string),
                },
              })
            }
          }
        )
        .subscribe((status, err) => {
          console.log('[Realtime Subscription Status]:', status)
          if (err) console.error('[Realtime Subscription Error]:', err)
        })
    }

    initSubscription()

    return () => {
      cancelled = true
      if (channel) {
        console.log('[useCaptureSocket] Cleaning up channel for key:', key)
        supabase.removeChannel(channel)
      }
    }
  }, [key])
}