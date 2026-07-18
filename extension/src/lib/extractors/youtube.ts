/**
 * Pure YouTube extractor: DOM -> normalized capture payload.
 *
 * No side effects, no globals — takes a Document + the page URL so it is
 * unit-testable in jsdom without a browser. Degrades gracefully when the
 * transcript panel is absent (still captures metadata).
 */
import type { ExtractedCapture } from "../contracts"

export interface TranscriptSegment {
  start: number // seconds
  text: string
}

export interface YoutubeArtifact {
  title: string
  url: string
  author: string | null
  duration: string | null
  transcript_available: boolean
  segments: TranscriptSegment[]
}

/** Parse "m:ss" or "h:mm:ss" into seconds. Returns 0 on malformed input. */
export function parseTimestamp(ts: string): number {
  const parts = ts
    .trim()
    .split(":")
    .map((p) => Number.parseInt(p, 10))
  if (parts.some((n) => Number.isNaN(n))) return 0
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

function text(el: Element | null): string {
  return (el?.textContent ?? "").trim()
}

export function extractYouTube(doc: Document, url: string): ExtractedCapture {
  const title =
    text(doc.querySelector("h1.ytd-watch-metadata")) ||
    doc.title.replace(/\s*-\s*YouTube\s*$/, "").trim()

  const author =
    text(doc.querySelector("ytd-channel-name#channel-name a")) ||
    text(doc.querySelector("#owner #channel-name a")) ||
    null

  const duration = text(doc.querySelector(".ytp-time-duration")) || null

  const segmentEls = Array.from(doc.querySelectorAll("ytd-transcript-segment-renderer"))
  const segments: TranscriptSegment[] = segmentEls
    .map((el) => ({
      start: parseTimestamp(text(el.querySelector(".segment-timestamp"))),
      text: text(el.querySelector(".segment-text")),
    }))
    .filter((s) => s.text.length > 0)

  const artifact: YoutubeArtifact = {
    title,
    url,
    author,
    duration,
    transcript_available: segments.length > 0,
    segments,
  }

  return {
    type: "youtube",
    url,
    title,
    author,
    content: JSON.stringify(artifact),
  }
}
