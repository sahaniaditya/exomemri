/**
 * Session bridge, running only on the exomemri web-app origin.
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

const LISTENERS_ATTACHED = "__atlasBridgeListeners"
const RELAY_HOOK = "__atlasBridgeRelay"

type BridgeWindow = Window & {
  [LISTENERS_ATTACHED]?: boolean
  [RELAY_HOOK]?: (clearIfMissing?: boolean) => Promise<void>
}

async function readAndRelay(clearIfMissing = true): Promise<void> {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(STORED_SESSION_KEY)
  } catch {
    return // Site data blocked — we know nothing, so assert nothing.
  }

  const blob = parseStoredSession(raw)
  try {
    if (blob) {
      await sendMessage("syncSession", blob)
    } else if (clearIfMissing) {
      await sendMessage("clearSession", undefined)
    }
  } catch {
    // "Extension context invalidated": this copy of the script was orphaned by
    // an extension reload and its port is gone for good. The background
    // re-injects a live copy (background/resync.ts), which rebinds RELAY_HOOK
    // below so the listeners already attached here start working again.
  }
}

export function runBridge(): void {
  const win = window as BridgeWindow

  // Always rebind, even on re-injection: the listeners below must call the
  // newest closure, since only the newest one can still reach the worker.
  win[RELAY_HOOK] = readAndRelay

  const relay = (clearIfMissing = true): void => {
    void win[RELAY_HOOK]?.(clearIfMissing)
  }

  // Don't wipe a live extension session just because SessionSync has not
  // mirrored into localStorage yet on this first paint.
  relay(false)

  // Re-injecting the same file re-executes the module; a window flag in this
  // isolated world survives so we don't stack listeners.
  if (win[LISTENERS_ATTACHED]) return
  win[LISTENERS_ATTACHED] = true

  // The web app announcing its own write, in this tab. The event carries no
  // payload on purpose — we re-read and re-validate localStorage ourselves
  // rather than trust anything the page hands us.
  window.addEventListener(SESSION_UPDATED_EVENT, () => relay())

  // Login/logout in another tab of this origin (fires only in other tabs).
  window.addEventListener("storage", (e) => {
    if (e.key === STORED_SESSION_KEY || e.key === null) relay()
  })

  // Returning to the tab: re-read in case the mirror changed while away.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") relay()
  })
}
