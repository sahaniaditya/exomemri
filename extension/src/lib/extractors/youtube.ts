/**
 * Pure YouTube extractor: DOM (+ optionally pre-fetched segments) -> payload.
 *
 * No side effects, no globals — takes a Document, the page URL and an options
 * bag, so it stays unit-testable in jsdom without a browser. Segments normally
 * arrive from the collector (which intercepts the player's own transcript
 * response); scraping an already-open panel is the fallback.
 *
 * The artifact JSON produced here IS the backend's dedupe identity — the server
 * recomputes the content hash from `content`. So everything in it must be
 * stable across captures of the same video: canonical URL, normalized segments,
 * and no fields whose value depends on when you happened to look. That is why
 * `duration` is absent (it reads empty until the player paints) and why the
 * acquisition tier is logged rather than stored.
 */
import type { ExtractedCapture } from "../contracts"
import { canonicalWatchUrl, videoIdFromUrl } from "../youtube-url"
import { normalizeSegments, type TranscriptSegment } from "./transcript-parse"

export type { TranscriptSegment }

export interface YoutubeArtifact {
  title: string
  url: string
  author: string | null
  video_id: string | null
  transcript_available: boolean
  segments: TranscriptSegment[]
}

export interface YoutubeExtractOptions {
  /** Segments acquired out-of-band; win over anything in the DOM. */
  segments?: readonly TranscriptSegment[] | null
  /** Canonical video id, when the caller has already parsed it. */
  videoId?: string | null
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

/** Read segments out of an open transcript panel. Shared with the panel tier. */
export function scrapeSegmentsFromDom(doc: Document): TranscriptSegment[] {
  return Array.from(doc.querySelectorAll("ytd-transcript-segment-renderer"))
    .map((el) => ({
      start: parseTimestamp(text(el.querySelector(".segment-timestamp"))),
      text: text(el.querySelector(".segment-text")),
    }))
    .filter((s) => s.text.length > 0)
}

export function extractYouTube(
  doc: Document,
  url: string,
  options?: YoutubeExtractOptions,
): ExtractedCapture {
  const title =
    text(doc.querySelector("h1.ytd-watch-metadata")) ||
    doc.title.replace(/\s*-\s*YouTube\s*$/, "").trim()

  const author =
    text(doc.querySelector("ytd-channel-name#channel-name a")) ||
    text(doc.querySelector("#owner #channel-name a")) ||
    null

  const videoId = options?.videoId ?? videoIdFromUrl(url)

  // Collapse ?t=42s, youtu.be/… and m.youtube.com/… onto one identity, so the
  // same video does not land as several rows.
  const canonicalUrl = videoId ? canonicalWatchUrl(videoId) : url

  const provided = options?.segments
  const segments = normalizeSegments(
    provided && provided.length > 0 ? provided : scrapeSegmentsFromDom(doc),
  )

  const artifact: YoutubeArtifact = {
    title,
    url: canonicalUrl,
    author,
    video_id: videoId,
    transcript_available: segments.length > 0,
    segments,
  }

  return {
    type: "youtube",
    url: canonicalUrl,
    title,
    author,
    content: JSON.stringify(artifact),
  }
}
