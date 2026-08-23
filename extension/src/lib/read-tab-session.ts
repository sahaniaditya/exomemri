/**
 * Read the web app's session mirror straight out of a tab's `localStorage`.
 *
 * The bridge content script is the fast path, but it only exists in tabs that
 * were loaded *after* the extension was: Chrome does not inject content
 * scripts retroactively, and reloading the extension (every `npm run dev`
 * rebuild) orphans the copies already running. `scripting.executeScript` has
 * no such gap, so this is the mechanism both the popup and the background
 * worker use to get an authoritative read on demand.
 *
 * Shared by both callers on purpose — the injected reader, the two keys it
 * reads, and the "unreadable vs. absent" distinction are one contract.
 */
import { browser } from "wxt/browser"

import { APP_MARKER_KEY, STORED_SESSION_KEY } from "./session-blob"

export interface TabSessionRead {
  /** Raw `atlas.session` JSON, or `null` when the page has none. */
  raw: string | null
  /** True when the page stamped `atlas.app` — i.e. it really is the web app. */
  isAppHost: boolean
}

/**
 * Read one tab, or `null` when it cannot be scripted (no host permission, a
 * `chrome://` page, a discarded tab). `null` means "no information" and must
 * never be read as "signed out".
 */
export async function readTabSession(tabId: number): Promise<TabSessionRead | null> {
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (sessionKey: string, markerKey: string) => {
        try {
          return {
            raw: window.localStorage.getItem(sessionKey),
            isAppHost: window.localStorage.getItem(markerKey) !== null,
          }
        } catch {
          // localStorage can throw outright when site data is blocked.
          return null
        }
      },
      args: [STORED_SESSION_KEY, APP_MARKER_KEY],
    })
    const value = results[0]?.result
    if (!value || typeof value !== "object") return null
    const { raw, isAppHost } = value as Partial<TabSessionRead>
    return {
      raw: typeof raw === "string" ? raw : null,
      isAppHost: isAppHost === true,
    }
  } catch {
    return null
  }
}
