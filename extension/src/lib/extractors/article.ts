/**
 * Pure article extractor using Mozilla Readability.
 *
 * Returns null when the page is not article-like (so the capture card does
 * not surface on, e.g., a homepage or app shell). Readability mutates the
 * document it parses, so we clone first to keep the extractor side-effect free.
 */
import { Readability } from "@mozilla/readability"

import type { ExtractedCapture } from "../contracts"

const MIN_ARTICLE_CHARS = 250

export function extractArticle(doc: Document, url: string): ExtractedCapture | null {
  const clone = doc.cloneNode(true) as Document
  const parsed = new Readability(clone).parse()

  if (!parsed || !parsed.textContent || parsed.textContent.trim().length < MIN_ARTICLE_CHARS) {
    return null
  }

  const title = (parsed.title || doc.title || url).trim()
  const author = parsed.byline?.trim() || null

  return {
    type: "article",
    url,
    title,
    author,
    content: parsed.textContent.trim(), // -> raw/extracted.txt
    raw_html: parsed.content ?? null, // cleaned HTML -> raw/page.html
  }
}
