'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { syncRealtimeAuth } from '@/lib/realtime-auth'
import { EXTENSION_SESSION_EVENT } from '@/lib/extension-session' // adjust path to wherever this constant lives
import type { CapturedSource } from '@/lib/dashboard-data'

const supabase = createClient()
 
export type CaptureStatusEvent = {
  sourceId: string
  patch: Partial<CapturedSource>
}
 
// Comfortably inside the 1-hour access-token lifetime, matching the
// cadence the extension bridge already uses for its own refresh.
const REALTIME_AUTH_REFRESH_MS = 15 * 60 * 1000
 
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
 
let channelSeq = 0
 
export function useCaptureSocket(
  spaceIds: string[],
  onStatus: (event: CaptureStatusEvent) => void,
  onNewCapture?: () => void
) {
  const onStatusRef = useRef(onStatus)
  onStatusRef.current = onStatus
 
  const onNewCaptureRef = useRef(onNewCapture)
  onNewCaptureRef.current = onNewCapture
 
  const key = spaceIds.filter(Boolean).sort().join(',')
 
  useEffect(() => {
    console.log('[useCaptureSocket] Running effect with key:', key)
 
    if (!key) {
      console.warn('[useCaptureSocket] Empty spaceIds key; skipping socket subscription.')
      return
    }
 
    let cancelled = false
    let createdChannel: ReturnType<typeof supabase.channel> | null = null
    let refreshTimer: number | undefined
 
    const runId = ++channelSeq
    const topic = `sources-status-${key}-${runId}`
 
    const filter =
      spaceIds.length === 1
        ? `space_id=eq.${spaceIds[0]}`
        : `space_id=in.(${spaceIds.join(',')})`
 
    console.log(`[useCaptureSocket #${runId}] Topic:`, topic, '| Filter:', filter)
 
    function subscribeChannel() {
      if (createdChannel || cancelled) return
 
      console.log(`[useCaptureSocket #${runId}] Subscribing to filter:`, filter)
 
      createdChannel = supabase
        .channel(topic)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'sources', filter },
          payload => {
            console.log(`[useCaptureSocket #${runId}] Realtime UPDATE Received:`, payload)
            const row = payload.new as Record<string, unknown>
            if (row?.id) {
              const uiStatus = toUiStatus(row.processing_status as string)
              onStatusRef.current({
                sourceId: row.id as string,
                patch: { status: uiStatus },
              })
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'sources', filter },
          payload => {
            console.log(`[useCaptureSocket #${runId}] Realtime INSERT Received:`, payload)
            // A new capture landed. We don't assemble a full CapturedSource
            // client-side here (spaceName, formatted meta, etc. are computed
            // server-side) — instead ask the page to refetch, which is cheap
            // and only fires once per new capture, not on a timer.
            onNewCaptureRef.current?.()
          }
        )
        .subscribe((status, err) => {
          console.log(`[useCaptureSocket #${runId}] Subscription Status:`, status)
          if (err) console.error(`[useCaptureSocket #${runId}] Subscription Error:`, err)
        })
    }
 
    async function init() {
      const token = await syncRealtimeAuth()
      if (cancelled) return
 
      console.log(`[useCaptureSocket #${runId}] Realtime auth token acquired:`, !!token)
 
      subscribeChannel()
 
      refreshTimer = window.setInterval(() => {
        syncRealtimeAuth()
      }, REALTIME_AUTH_REFRESH_MS)
    }
 
    function handleSessionUpdated() {
      console.log(`[useCaptureSocket #${runId}] ${EXTENSION_SESSION_EVENT} fired — resyncing realtime auth.`)
      syncRealtimeAuth()
    }
    window.addEventListener(EXTENSION_SESSION_EVENT, handleSessionUpdated)
 
    init()
 
    return () => {
      console.log(`[useCaptureSocket #${runId}] Cleaning up channel for key:`, key)
      cancelled = true
      window.clearInterval(refreshTimer)
      window.removeEventListener(EXTENSION_SESSION_EVENT, handleSessionUpdated)
      if (createdChannel) {
        supabase.removeChannel(createdChannel)
      }
    }
  }, [key])
}
 