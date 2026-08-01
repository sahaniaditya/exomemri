/**
 * Session bridge, running only on the Atlas web-app origin.
 *
 * A content script shares the page's `localStorage`, so it can read the
 * `atlas.session` blob the web app writes there and relay it to the background
 * worker (the extension's only session holder). The extension's popup/content
 * live on a different origin and cannot read that localStorage directly — this
 * bridge is the crossing point.
 *
 * It relays on load, on the web app's own `atlas:session-updated` event
 * (same-tab writes, which fire no `storage` event), on cross-tab `storage`
 * events (login/logout elsewhere), and when the tab becomes visible again.
 */
import { sendMessage } from "../lib/messaging"
import {
  parseStoredSession,
  SESSION_UPDATED_EVENT,
  STORED_SESSION_KEY,
} from "../lib/session-blob"

function readAndRelay(): void {
  const blob = parseStoredSession(window.localStorage.getItem(STORED_SESSION_KEY))
  if (blob) {
    void sendMessage("syncSession", blob)
  } else {
    void sendMessage("clearSession", undefined)
  }
}

export function runBridge(): void {
  readAndRelay()

  // The web app announcing its own write, in this tab. The event carries no
  // payload on purpose — we re-read and re-validate localStorage ourselves
  // rather than trust anything the page hands us.
  window.addEventListener(SESSION_UPDATED_EVENT, () => readAndRelay())

  // Login/logout in another tab of this origin (fires only in other tabs).
  window.addEventListener("storage", (e) => {
    if (e.key === STORED_SESSION_KEY || e.key === null) readAndRelay()
  })

  // Same-tab writes + returning to the tab: re-read when it becomes visible.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") readAndRelay()
  })
}
