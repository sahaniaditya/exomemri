/**
 * ISOLATED-world collector for YouTube transcripts.
 *
 * Owns the cache, the triggers, and the escalation from "listen" to "open the
 * panel". By the time the user hits Save the transcript is normally already
 * here, so Save stays instant.
 *
 * Two acquisition tiers:
 *   0. passive — the MAIN-world taps forward the player's own transcript
 *      response over the bridge; costs nothing and touches nothing;
 *   1. panel — shortly after playback starts, if tier 0 produced nothing, open
 *      YouTube's transcript panel so YouTube fetches the transcript itself.
 *
 * Deliberately absent: issuing our own InnerTube calls. It would raise the hit
 * rate, but repeated self-issued API calls risk Google flagging the user's own
 * account, and tier 1 covers the same ground safely.
 */
import type { TranscriptSegment } from "../lib/extractors/transcript-parse"
import { videoIdFromUrl } from "../lib/youtube-url"
import { isSameWindowOrigin } from "../lib/yt-bridge"
import { createTranscriptCache } from "./transcript-cache"
import { setYtHandle } from "./youtube-handle"
import { openTranscriptPanel, waitForPanelSegments } from "./youtube-panel"

/** Grace period after playback starts before we escalate to the panel tier. */
const PROACTIVE_DELAY_MS = 2_000

/** How long the panel gets to populate once opened. */
const PANEL_TIMEOUT_MS = 4_000

/** Second chance before concluding a video has no captions at all. */
const RETRY_DELAY_MS = 2_500

/** Safety net for SPA navigations that fire no event we listen for. */
const HREF_POLL_MS = 750

const cache = createTranscriptCache()
const escalating = new Set<string>()
const scheduled = new Set<string>()

/** True once the watch page has actually rendered, so "no button" is meaningful. */
function watchPageReady(doc: Document): boolean {
  return doc.querySelector("ytd-watch-flexy") !== null || doc.querySelector("video") !== null
}

/**
 * Tier 1. Open the panel and wait for it to fill.
 *
 * Re-checks the current video before writing: this function spans several
 * seconds, and on a single-page navigation the DOM it scrapes at the end may
 * belong to a different video than the one it started on.
 */
async function escalate(videoId: string, attempt = 0): Promise<void> {
  if (cache.isSettled(videoId) || escalating.has(videoId)) return
  escalating.add(videoId)

  try {
    if (!openTranscriptPanel(document)) {
      // No button means no caption tracks — but a slow render looks identical,
      // and marking a video caption-less is sticky for the rest of the session.
      // So give it one more chance before believing it.
      if (attempt === 0) {
        setTimeout(() => void escalate(videoId, 1), RETRY_DELAY_MS)
        return
      }
      if (watchPageReady(document)) cache.markEmpty(videoId)
      return
    }

    const segments = await waitForPanelSegments(document, PANEL_TIMEOUT_MS)

    if (videoIdFromUrl(location.href) !== videoId) return // navigated away
    if (cache.isSettled(videoId)) return // interception got there first
    if (segments.length > 0) cache.put(videoId, segments)
  } catch {
    // The panel tier is best-effort; a failure just leaves the entry pending.
  } finally {
    escalating.delete(videoId)
  }
}

function scheduleEscalation(videoId: string): void {
  if (scheduled.has(videoId)) return
  scheduled.add(videoId)
  setTimeout(() => {
    scheduled.delete(videoId)
    if (!cache.isSettled(videoId)) void escalate(videoId)
  }, PROACTIVE_DELAY_MS)
}

/** Every trigger funnels here; idempotent per video. */
function request(videoId: string | null): void {
  if (!videoId) return
  cache.prime(videoId)
  scheduleEscalation(videoId)
}

/**
 * What `collect.ts` awaits at capture time. Resolves segments, or null when the
 * video has no captions or the deadline passes first. Never rejects.
 */
async function awaitTranscript(
  videoId: string,
  timeoutMs: number,
): Promise<TranscriptSegment[] | null> {
  cache.prime(videoId)

  // The user beat the proactive timer — escalate now rather than waiting it out.
  if (!cache.isSettled(videoId)) void escalate(videoId)

  return cache.waitFor(videoId, timeoutMs)
}

export function initYoutubeCollector(): void {
  setYtHandle({ awaitTranscript })

  window.addEventListener("message", (event: MessageEvent) => {
    cache.handleMessage(event.data, isSameWindowOrigin(event, window))
  })

  // Capture phase on the document: YouTube swaps the <video> element out, so a
  // listener bound to the element itself would go stale after a navigation.
  document.addEventListener(
    "play",
    () => request(videoIdFromUrl(location.href)),
    { capture: true },
  )

  window.addEventListener("yt-navigate-finish", () =>
    request(videoIdFromUrl(location.href)),
  )

  // YouTube has quietly renamed its navigation events before; this cannot break.
  let lastHref = location.href
  setInterval(() => {
    if (location.href === lastHref) return
    lastHref = location.href
    request(videoIdFromUrl(location.href))
  }, HREF_POLL_MS)

  request(videoIdFromUrl(location.href))
}
