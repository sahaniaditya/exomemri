import type { ContentScriptContext } from "wxt/utils/content-script-context"

import { extractYouTube } from "../../lib/extractors"
import { mountCaptureCard } from "../capture-card/mount"

export async function runYouTube(ctx: ContentScriptContext): Promise<void> {
  const extracted = extractYouTube(document, location.href)
  await mountCaptureCard(ctx, extracted)
}
