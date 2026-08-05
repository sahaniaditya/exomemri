/**
 * The MAIN <-> ISOLATED world bridge for YouTube transcript capture.
 *
 * Imported by both worlds, so it must stay free of `chrome.*` — the MAIN world
 * has no `chrome.runtime` and @webext-core/messaging is unavailable there.
 *
 * ON TRUST — read this before adding a "security" comment that overclaims.
 * A nonce sent over postMessage is NOT a secret: any page script can read it
 * with a passive listener and forge messages perfectly. The honest framing is
 * that MAIN-world output is exactly as trustworthy as the DOM, which the
 * YouTube extractor already reads from page-controlled nodes. This bridge adds
 * no privilege escalation: MAIN has no extension APIs, the messages carry no
 * capability, no URL from them is dereferenced, and no code is evaluated.
 *
 * What the validation below actually buys, and all it buys:
 *   1. crash-safety against malformed data,
 *   2. size bounds (the only real DoS surface — the payload ends up
 *      JSON-stringified into `content` and POSTed to the backend),
 *   3. no cross-frame or cross-origin leakage.
 */
import type { TranscriptSegment } from "./extractors/transcript-parse"
import { MAX_SEGMENTS, MAX_SEGMENT_CHARS } from "./extractors/transcript-parse"

export const YT_BRIDGE_CHANNEL = "atlas.yt.transcript"
export const YT_BRIDGE_VERSION = 1

const VIDEO_ID = /^[\w-]{6,32}$/

export type YtBridgeFailure = "no-captions" | "error"

export type YtBridgeMessage =
  | {
      ch: typeof YT_BRIDGE_CHANNEL
      v: typeof YT_BRIDGE_VERSION
      kind: "result"
      videoId: string
      segments: TranscriptSegment[]
    }
  | {
      ch: typeof YT_BRIDGE_CHANNEL
      v: typeof YT_BRIDGE_VERSION
      kind: "failed"
      videoId: string
      reason: YtBridgeFailure
    }

function asObject(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

/** Truncate rather than reject — a slightly-too-large payload is still useful. */
function parseSegments(raw: unknown): TranscriptSegment[] | null {
  if (!Array.isArray(raw)) return null
  const out: TranscriptSegment[] = []
  for (const item of raw.slice(0, MAX_SEGMENTS)) {
    const seg = asObject(item)
    if (!seg) continue
    const { start, text } = seg
    if (typeof start !== "number" || !Number.isFinite(start)) continue
    if (typeof text !== "string") continue
    out.push({ start, text: text.slice(0, MAX_SEGMENT_CHARS) })
  }
  return out
}

/** Total structural validation. Returns null for anything unrecognized. */
export function parseYtBridgeMessage(raw: unknown): YtBridgeMessage | null {
  const msg = asObject(raw)
  if (!msg) return null
  if (msg.ch !== YT_BRIDGE_CHANNEL || msg.v !== YT_BRIDGE_VERSION) return null

  const videoId = msg.videoId
  if (typeof videoId !== "string" || !VIDEO_ID.test(videoId)) return null

  if (msg.kind === "result") {
    const segments = parseSegments(msg.segments)
    if (!segments) return null
    return { ch: YT_BRIDGE_CHANNEL, v: YT_BRIDGE_VERSION, kind: "result", videoId, segments }
  }

  if (msg.kind === "failed") {
    const reason = msg.reason
    if (reason !== "no-captions" && reason !== "error") return null
    return { ch: YT_BRIDGE_CHANNEL, v: YT_BRIDGE_VERSION, kind: "failed", videoId, reason }
  }

  return null
}

/**
 * Same-window, same-origin check. Rejects iframes, openers and about:blank
 * frames before the payload is even looked at.
 */
export function isSameWindowOrigin(event: MessageEvent, win: Window): boolean {
  return event.source === win && event.origin === win.location.origin
}

/** Send to the other world. Never `"*"` — that would leak to a cross-origin opener. */
export function postYtBridgeMessage(win: Window, msg: YtBridgeMessage): void {
  try {
    win.postMessage(msg, win.location.origin)
  } catch {
    // A structured-clone or origin failure must never break the caller.
  }
}
