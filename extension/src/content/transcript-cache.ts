/**
 * Transcript cache, keyed strictly by video id.
 *
 * Pure: no `window`, no listeners, no timers other than the ones it owns. The
 * DOM wiring lives in youtube-collect.ts so this surface can be unit-tested.
 *
 * Keying by the video id echoed in the payload — rather than "whatever video is
 * playing when the response lands" — is the correctness linchpin. YouTube is a
 * single-page app, so a response for video A routinely arrives after the user
 * has navigated to video B, and misattributing it would write silently wrong
 * data into the user's knowledge base.
 */
import type { TranscriptSegment } from "../lib/extractors/transcript-parse"
import { parseYtBridgeMessage } from "../lib/yt-bridge"

type Entry =
  | {
      status: "pending"
      promise: Promise<TranscriptSegment[] | null>
      resolve: (value: TranscriptSegment[] | null) => void
    }
  | { status: "done"; segments: TranscriptSegment[] }
  | { status: "empty" } // authoritatively no captions for this video

export interface TranscriptCache {
  /** Feed a raw bridge message. Non-conforming input is dropped silently. */
  handleMessage(raw: unknown, trusted: boolean): void
  /** Resolves segments, or null on "no captions" and on timeout. Never rejects. */
  waitFor(videoId: string, timeoutMs: number): Promise<TranscriptSegment[] | null>
  /** Record a result. First write wins, so a later duplicate cannot flip it. */
  put(videoId: string, segments: TranscriptSegment[]): void
  /** Record that this video has no captions at all. */
  markEmpty(videoId: string): void
  /** Start (or keep) a pending entry without waiting on it. */
  prime(videoId: string): void
  /** True once a result or an authoritative "empty" has landed. */
  isSettled(videoId: string): boolean
  size(): number
}

const DEFAULT_MAX_ENTRIES = 20

export function createTranscriptCache(
  maxEntries: number = DEFAULT_MAX_ENTRIES,
): TranscriptCache {
  const entries = new Map<string, Entry>()

  function evictIfNeeded(): void {
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next()
      if (oldest.done) return
      const entry = entries.get(oldest.value)
      // Never strand a waiter on an evicted entry.
      if (entry?.status === "pending") entry.resolve(null)
      entries.delete(oldest.value)
    }
  }

  function pending(videoId: string): Entry {
    const existing = entries.get(videoId)
    if (existing) return existing

    let resolve: (value: TranscriptSegment[] | null) => void = () => {}
    const promise = new Promise<TranscriptSegment[] | null>((res) => {
      resolve = res
    })
    const entry: Entry = { status: "pending", promise, resolve }
    entries.set(videoId, entry)
    evictIfNeeded()
    return entry
  }

  function settle(videoId: string, next: Entry, value: TranscriptSegment[] | null): void {
    const existing = entries.get(videoId)
    // First write wins: otherwise the captured content would depend on which of
    // several racing responses happened to arrive last.
    if (existing && existing.status !== "pending") return
    entries.set(videoId, next)
    evictIfNeeded()
    if (existing?.status === "pending") existing.resolve(value)
  }

  return {
    prime(videoId) {
      pending(videoId)
    },

    put(videoId, segments) {
      settle(videoId, { status: "done", segments }, segments)
    },

    markEmpty(videoId) {
      settle(videoId, { status: "empty" }, null)
    },

    isSettled(videoId) {
      const entry = entries.get(videoId)
      return entry !== undefined && entry.status !== "pending"
    },

    size() {
      return entries.size
    },

    handleMessage(raw, trusted) {
      if (!trusted) return
      const msg = parseYtBridgeMessage(raw)
      if (!msg) return
      if (msg.kind === "result") {
        if (msg.segments.length > 0) this.put(msg.videoId, msg.segments)
        return
      }
      // A parse error is not evidence of "no captions" — only leave the entry
      // pending, so the panel tier still gets its chance.
      if (msg.reason === "no-captions") this.markEmpty(msg.videoId)
    },

    waitFor(videoId, timeoutMs) {
      const entry = pending(videoId)
      if (entry.status === "done") return Promise.resolve(entry.segments)
      if (entry.status === "empty") return Promise.resolve(null)

      let timer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs)
      })

      // The timeout resolves null and never rejects, and the pending entry is
      // deliberately left in place: a slow response still lands, so the next
      // save is instant instead of repeating the wait.
      return Promise.race([entry.promise, timeout]).finally(() => {
        if (timer !== undefined) clearTimeout(timer)
      })
    },
  }
}
