/**
 * Content-script logic: extract the current page on demand.
 *
 * No UI. It registers a single handler that the background worker calls
 * (targeted at this tab) when the user hits Save in the popup. Site type is
 * chosen from the URL; each extractor is a pure function (see lib/extractors).
 */
import type { ExtractedCapture } from "../lib/contracts"
import { extractAiChat, extractArticle, extractYouTube } from "../lib/extractors"
import { onMessage } from "../lib/messaging"

export function detectAndExtract(doc: Document, url: string): ExtractedCapture | null {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return null
  }

  if (host.endsWith("youtube.com")) return extractYouTube(doc, url)
  if (host === "chatgpt.com" || host === "chat.openai.com") return extractAiChat(doc, url)
  return extractArticle(doc, url)
}

export function registerExtractor(): void {
  // Idempotent: the script may be present declaratively AND injected on demand
  // by the background (for tabs opened before the extension loaded). Register
  // the handler only once.
  const g = globalThis as unknown as { __atlasExtractorRegistered?: boolean }
  if (g.__atlasExtractorRegistered) return
  g.__atlasExtractorRegistered = true
  onMessage("extractCurrentPage", () => detectAndExtract(document, location.href))
}
