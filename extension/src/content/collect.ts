/**
 * Content-script logic: extract the current page on demand.
 *
 * No UI. It registers a single handler that the background worker calls
 * (targeted at this tab) when the user hits Save in the popup. The routing and
 * extraction themselves live in detect.ts, which stays free of extension APIs
 * so it can be unit-tested; this module is only the wiring.
 */
import { onMessage } from "../lib/messaging"
import { detectAndExtract, detectAndExtractAsync } from "./detect"

export { detectAndExtract, detectAndExtractAsync } from "./detect"

/**
 * Absolute ceiling on the handler. Nothing else in the capture path has a
 * timeout, so this is the only thing between a hung request and a popup stuck
 * on "Saving…" forever. It must also stay below the messaging timeout: if
 * `sendMessage` gives up, the background injects a second content script and
 * the whole extraction runs twice.
 */
const HANDLER_CEILING_MS = 5_000

function withDeadline<T>(work: Promise<T>, ms: number, fallback: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback()), ms)
  })
  return Promise.race([work, deadline]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}

export function registerExtractor(): void {
  // Idempotent: the script may be present declaratively AND injected on demand
  // by the background (for tabs opened before the extension loaded). Register
  // the handler only once.
  const g = globalThis as unknown as { __atlasExtractorRegistered?: boolean }
  if (g.__atlasExtractorRegistered) return
  g.__atlasExtractorRegistered = true
  onMessage("extractCurrentPage", () =>
    withDeadline(detectAndExtractAsync(document, location.href), HANDLER_CEILING_MS, () =>
      detectAndExtract(document, location.href),
    ),
  )
}
