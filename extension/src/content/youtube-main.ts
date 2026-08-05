/**
 * MAIN-world half of YouTube transcript capture.
 *
 * Runs in the page's own JavaScript realm, which is the entire point: only
 * page-realm code can see the player's `fetch`, and the player's requests
 * already carry the proof-of-origin token that makes caption URLs work. We
 * never mint that token — we just read what YouTube fetches anyway.
 *
 * This module must not import `messaging.ts` or anything touching `chrome.*`:
 * the MAIN world has no extension APIs and such an import throws on load.
 */
import {
  parseInnertubeTranscript,
  parseTimedtextJson3,
  parseTimedtextXml,
  type ParseResult,
} from "../lib/extractors/transcript-parse"
import { installXhrTap, wrapFetch, type TranscriptCapture } from "../lib/youtube-fetch-hook"
import { videoIdFromUrl } from "../lib/youtube-url"
import { postYtBridgeMessage, YT_BRIDGE_CHANNEL, YT_BRIDGE_VERSION } from "../lib/yt-bridge"

const loggedReasons = new Set<string>()

/**
 * Schema drift is the failure mode that kills this feature silently, so it gets
 * a diagnosable log — once per reason per session, not per response.
 */
function logDrift(kind: string, result: ParseResult): void {
  if (result.ok) return
  const key = `${kind}:${result.reason}`
  if (loggedReasons.has(key)) return
  loggedReasons.add(key)
  console.debug(
    `[atlas] transcript parse failed (${kind}): ${result.reason}`,
    result.topLevelKeys,
  )
}

function parseBody(url: string, body: string): ParseResult {
  if (url.includes("get_transcript")) {
    try {
      return parseInnertubeTranscript(JSON.parse(body))
    } catch {
      return { ok: false, reason: "invalid-json", topLevelKeys: [] }
    }
  }

  // timedtext serves json3 or the legacy XML depending on &fmt.
  try {
    return parseTimedtextJson3(JSON.parse(body))
  } catch {
    return parseTimedtextXml(body)
  }
}

/**
 * Which video a response belongs to. The request URL wins when it says so
 * (timedtext carries `v`), then the id captured when the request was issued,
 * and only then the current location.
 */
function resolveVideoId(capture: TranscriptCapture): string | null {
  try {
    const fromRequest = new URL(capture.url, location.href).searchParams.get("v")
    if (fromRequest) return fromRequest
  } catch {
    // Relative or malformed URL — fall through.
  }
  return capture.tag ?? videoIdFromUrl(location.href)
}

function handleCapture(capture: TranscriptCapture): void {
  const videoId = resolveVideoId(capture)
  if (!videoId) return

  const kind = capture.url.includes("get_transcript") ? "innertube" : "timedtext"
  const result = parseBody(capture.url, capture.body)

  if (!result.ok) {
    logDrift(kind, result)
    return
  }

  postYtBridgeMessage(window, {
    ch: YT_BRIDGE_CHANNEL,
    v: YT_BRIDGE_VERSION,
    kind: "result",
    videoId,
    segments: result.segments,
  })
}

interface MainWorldFlag {
  __atlasYtMain?: boolean
}

export function runYoutubeMain(): void {
  const g = globalThis as unknown as MainWorldFlag
  if (g.__atlasYtMain) return
  g.__atlasYtMain = true

  // Order matters more than anything else in this file. The taps must be in
  // place before YouTube's bundle parses and caches its own reference to
  // `fetch`, so nothing may run before this — no awaits, no page reads.
  const tagger = (): string | null => videoIdFromUrl(location.href)

  try {
    window.fetch = wrapFetch(window.fetch.bind(window), handleCapture, tagger) as typeof fetch
  } catch {
    // If patching fails the panel tier still works; never break the page.
  }

  try {
    installXhrTap(XMLHttpRequest, handleCapture, tagger)
  } catch {
    // Same: a failed tap degrades the feature, it does not break YouTube.
  }
}
