import type { ContentScriptContext } from "wxt/utils/content-script-context"

import { extractArticle } from "../../lib/extractors"
import { mountCaptureCard } from "../capture-card/mount"

export async function runArticle(ctx: ContentScriptContext): Promise<void> {
  // Runtime article-guard: the card surfaces only on article-like pages.
  const extracted = extractArticle(document, location.href)
  if (!extracted) return
  await mountCaptureCard(ctx, extracted)
}
