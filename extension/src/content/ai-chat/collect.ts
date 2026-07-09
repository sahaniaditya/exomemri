import type { ContentScriptContext } from "wxt/utils/content-script-context"

import { extractAiChat } from "../../lib/extractors"
import { mountCaptureCard } from "../capture-card/mount"

export async function runAiChat(ctx: ContentScriptContext): Promise<void> {
  const extracted = extractAiChat(document, location.href)
  if (!extracted) return
  await mountCaptureCard(ctx, extracted)
}
