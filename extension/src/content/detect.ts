/**
 * Site detection and extraction — the pure half of the content script.
 *
 * Split out of collect.ts deliberately: that module registers a message
 * handler, which drags in the webextension polyfill and refuses to load outside
 * a real extension. Everything here is importable from vitest.
 */
import type { ExtractedCapture } from "../lib/contracts"
import { extractAiChat, extractArticle, extractYouTube } from "../lib/extractors"
import type { TranscriptSegment } from "../lib/extractors/transcript-parse"
import type { YoutubeExtractOptions } from "../lib/extractors/youtube"
import { videoIdFromUrl } from "../lib/youtube-url"
import { getYtHandle } from "./youtube-handle"

/** How long Save will wait for a transcript that has not arrived yet. */
export const TRANSCRIPT_TIMEOUT_MS = 2_500

export type TranscriptGetter = (videoId: string) => Promise<TranscriptSegment[] | null>

export function detectAndExtract(
  doc: Document,
  url: string,
  yt?: YoutubeExtractOptions,
): ExtractedCapture | null {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return null
  }

  // Route on "is this a video", not "is this youtube.com" — the homepage and
  // /feed/* are pages, and sending them to the video extractor would also make
  // them wait out the transcript budget for a transcript that cannot exist.
  if (videoIdFromUrl(url) !== null) return extractYouTube(doc, url, yt)
  if (host === "chatgpt.com" || host === "chat.openai.com") return extractAiChat(doc, url)
  return extractArticle(doc, url)
}

function transcriptFromCollector(videoId: string): Promise<TranscriptSegment[] | null> {
  const handle = getYtHandle()
  if (!handle) return Promise.resolve(null)
  return handle.awaitTranscript(videoId, TRANSCRIPT_TIMEOUT_MS)
}

export async function detectAndExtractAsync(
  doc: Document,
  url: string,
  getTranscript: TranscriptGetter = transcriptFromCollector,
): Promise<ExtractedCapture | null> {
  const videoId = videoIdFromUrl(url)
  if (videoId === null) return detectAndExtract(doc, url)

  let segments: TranscriptSegment[] | null = null
  try {
    segments = await getTranscript(videoId)
  } catch {
    // A failed transcript lookup must never fail the capture.
  }

  return detectAndExtract(doc, url, { segments, videoId })
}
