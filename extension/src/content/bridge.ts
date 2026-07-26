/**
 * Session bridge, running only on the Atlas web-app origin.
 *
 * A content script shares the page's `localStorage`, so it can read the
 * `atlas.session` blob the web app writes there and relay it to the background
 * worker (the extension's only session holder). The extension's popup/content
 * live on a different origin and cannot read that localStorage directly — this
 * bridge is the crossing point.
 *
 * It relays on load, on cross-tab `storage` events (login/logout elsewhere),
 * and when the tab becomes visible again (covers same-tab writes the `storage`
 * event does not fire for).
 */
import { sendMessage } from "../lib/messaging"
import { parseStoredSession, STORED_SESSION_KEY } from "../lib/session-blob"

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

  // Login/logout in another tab of this origin (fires only in other tabs).
  window.addEventListener("storage", (e) => {
    if (e.key === STORED_SESSION_KEY || e.key === null) readAndRelay()
  })

  // Same-tab writes + returning to the tab: re-read when it becomes visible.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") readAndRelay()
  })
}
