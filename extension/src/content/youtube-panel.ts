/**
 * The panel tier: open YouTube's own transcript panel and let YouTube fetch the
 * transcript for us.
 *
 * This is the tier that makes the feature work on videos where nothing was
 * intercepted. Clicking "Show transcript" makes the *player* issue the request,
 * so the proof-of-origin token is handled internally and we never have to forge
 * anything or call YouTube's API ourselves.
 *
 * The panel is allowed to open visibly — no cloaking, no restore. That was a
 * deliberate product call, and it removes the most fragile part of the design.
 */
import { scrapeSegmentsFromDom } from "../lib/extractors/youtube"
import type { TranscriptSegment } from "../lib/extractors/transcript-parse"

const SEGMENT = "ytd-transcript-segment-renderer"

/** How long the segment list must stop changing before we call it settled. */
const SETTLE_MS = 300

/** Ordered by specificity; YouTube A/B-tests where this button lives. */
const BUTTON_SELECTORS = [
  "ytd-video-description-transcript-section-renderer button",
  'button[aria-label*="transcript" i]',
]

function byText(doc: Document): HTMLElement | null {
  const items = doc.querySelectorAll<HTMLElement>(
    "ytd-menu-service-item-renderer, tp-yt-paper-item, button",
  )
  for (const el of items) {
    if (/transcript/i.test(el.textContent ?? "")) return el
  }
  return null
}

export function findTranscriptButton(doc: Document): HTMLElement | null {
  for (const selector of BUTTON_SELECTORS) {
    const el = doc.querySelector<HTMLElement>(selector)
    if (el) return el
  }
  return byText(doc)
}

/**
 * Click the transcript button, expanding the description first if that is where
 * the button is hiding. Returns false when there is no button at all, which is
 * the signal that the video genuinely has no captions.
 */
export function openTranscriptPanel(doc: Document): boolean {
  let button = findTranscriptButton(doc)

  if (!button) {
    // On some layouts the button only exists inside the expanded description.
    const expand = doc.querySelector<HTMLElement>("tp-yt-paper-button#expand, #expand")
    if (expand) {
      try {
        expand.click()
      } catch {
        // Expansion is best-effort; the panel may still be reachable.
      }
      button = findTranscriptButton(doc)
    }
  }

  if (!button) return false

  try {
    button.click()
    return true
  } catch {
    return false
  }
}

/**
 * Resolve once the transcript panel's segment list has stopped growing, or at
 * the deadline. Always resolves — never rejects — with whatever is in the DOM.
 */
export function waitForPanelSegments(
  doc: Document,
  timeoutMs: number,
): Promise<TranscriptSegment[]> {
  return new Promise((resolve) => {
    let settled = false
    let debounce: ReturnType<typeof setTimeout> | undefined

    const finish = (): void => {
      if (settled) return
      settled = true
      observer.disconnect()
      if (debounce !== undefined) clearTimeout(debounce)
      clearTimeout(deadline)
      resolve(scrapeSegmentsFromDom(doc))
    }

    const nudge = (): void => {
      if (doc.querySelectorAll(SEGMENT).length === 0) return
      if (debounce !== undefined) clearTimeout(debounce)
      debounce = setTimeout(finish, SETTLE_MS)
    }

    const observer = new MutationObserver(nudge)
    const deadline = setTimeout(finish, timeoutMs)

    try {
      observer.observe(doc.body, { childList: true, subtree: true })
    } catch {
      // No body yet — the deadline still resolves this.
    }

    // The panel may already be open, in which case no mutation is coming.
    nudge()
  })
}
