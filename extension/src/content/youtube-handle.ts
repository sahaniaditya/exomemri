/**
 * The seam between the two isolated content scripts on a YouTube page.
 *
 * `content.ts` (all URLs) and `youtube.content.ts` (youtube.com) share a JS
 * realm but not module scope — each WXT entrypoint is its own bundle. This
 * global is how the extractor reaches the collector, mirroring the
 * `__atlasExtractorRegistered` convention already used in collect.ts.
 *
 * This is the ISOLATED world's globalThis, so it is not reachable from page
 * script. If the collector never ran (extension installed while a YouTube tab
 * was already open) the getter returns null and capture falls back to the
 * synchronous DOM path — exactly the old behavior, no regression.
 */
import type { TranscriptSegment } from "../lib/extractors/transcript-parse"

export interface YtHandle {
  /** Resolves segments, or null when unavailable. Never rejects. */
  awaitTranscript(videoId: string, timeoutMs: number): Promise<TranscriptSegment[] | null>
}

interface HandleHost {
  __atlasYt?: YtHandle
}

export function setYtHandle(handle: YtHandle): void {
  ;(globalThis as unknown as HandleHost).__atlasYt = handle
}

export function getYtHandle(): YtHandle | null {
  return (globalThis as unknown as HandleHost).__atlasYt ?? null
}
