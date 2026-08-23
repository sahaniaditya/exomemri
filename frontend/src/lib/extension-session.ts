/**
 * Bridge to the Atlas browser extension.
 *
 * The web app stores auth in httpOnly cookies, which the extension cannot read.
 * To let the extension pick up the logged-in session, we mirror a minimal,
 * client-readable copy into `localStorage` under `atlas.session`. A content
 * script the extension injects on this origin reads that key and relays it to
 * the extension's background worker.
 *
 * Deliberate tradeoff: the access/refresh tokens become readable by page JS
 * (an XSS exposure the httpOnly cookies avoid). Keep tokens short-lived and the
 * origin's CSP tight.
 */

/** localStorage key. Mirrors the extension's `atlas.*` namespace. */
export const EXTENSION_SESSION_KEY = "atlas.session"

/**
 * Dispatched on `window` after every write, so the extension's bridge content
 * script re-reads immediately.
 *
 * Necessary because a same-tab `localStorage` write fires no `storage` event:
 * without this, a space created on the dashboard would stay invisible to the
 * extension until the tab next became visible, and opening the toolbar popup
 * does not make the page visible again. Keep in sync with
 * `extension/src/lib/session-blob.ts`.
 */
export const EXTENSION_SESSION_EVENT = "atlas:session-updated"

/**
 * Durable marker saying "this page is the Atlas web app", written once on
 * mount and never removed — including while signed out.
 *
 * The extension reads tabs directly (it cannot rely on a content script being
 * injected), and in dev every `localhost` port is a trusted origin. Without
 * this marker the extension cannot tell a signed-out Atlas tab from an
 * unrelated `localhost:8000` tab, and would sign the user out on seeing the
 * latter. Keep in sync with `APP_MARKER_KEY` in
 * `extension/src/lib/session-blob.ts`.
 */
export const EXTENSION_APP_MARKER_KEY = "atlas.app"

/**
 * How often an open tab re-mirrors the session, comfortably inside the access
 * token's 1-hour lifetime.
 *
 * The extension treats an expired blob as signed out, so the mirror has to be
 * refreshed while the tab sits open — otherwise the popup goes "signed out"
 * an hour into a session the dashboard still considers live.
 */
export const EXTENSION_SESSION_REFRESH_MS = 15 * 60 * 1000

/** Stamp this origin as the Atlas web app (idempotent, no-op on the server). */
export function markExtensionHost(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(EXTENSION_APP_MARKER_KEY, "1")
  } catch {
    // Site data blocked — the extension falls back to its other signals.
  }
}

function announce(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(EXTENSION_SESSION_EVENT))
}

/** Shape returned by GET /api/auth/bridge-session. */
export interface BridgeSessionResponse {
  access_token: string
  refresh_token: string | null
  user: { id: string; email: string }
  space_id: string | null
  space_name: string | null
}

/** The JSON blob written to localStorage for the extension to consume. */
export interface StoredExtensionSession extends BridgeSessionResponse {
  version: 1
  /** Access-token expiry, epoch seconds (from the JWT `exp` claim). */
  expires_at: number
  /** When this blob was written, epoch seconds. */
  updated_at: number
}

/** Decode a JWT's `exp` (epoch seconds); fall back to now + 1h on any error. */
function jwtExpirySeconds(token: string): number {
  const fallback = Math.floor(Date.now() / 1000) + 3600
  try {
    const payload = token.split(".")[1]
    if (!payload) return fallback
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=")
    const claims = JSON.parse(atob(padded)) as { exp?: number }
    return typeof claims.exp === "number" ? claims.exp : fallback
  } catch {
    return fallback
  }
}

/** Build the stored blob from a bridge-session response. */
export function buildStoredSession(data: BridgeSessionResponse): StoredExtensionSession {
  return {
    version: 1,
    ...data,
    expires_at: jwtExpirySeconds(data.access_token),
    updated_at: Math.floor(Date.now() / 1000),
  }
}

/** Write the session blob to localStorage (no-op outside the browser). */
export function writeExtensionSession(data: BridgeSessionResponse): void {
  if (typeof window === "undefined") return
  localStorage.setItem(EXTENSION_SESSION_KEY, JSON.stringify(buildStoredSession(data)))
  announce()
}

/** Remove the session blob (call on logout / when signed out). */
export function clearExtensionSession(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(EXTENSION_SESSION_KEY)
  announce()
}

/**
 * Re-fetch the session and mirror it for the extension.
 *
 * Call this after anything that changes what the extension should know — most
 * importantly the active space, since that is what capture writes into. On 401
 * the cached blob is cleared; a network hiccup leaves it untouched.
 */
export async function refreshExtensionSession(): Promise<void> {
  try {
    const res = await fetch("/api/auth/bridge-session", {
      cache: "no-store",
      credentials: "include",
    })
    if (res.ok) {
      writeExtensionSession((await res.json()) as BridgeSessionResponse)
    } else if (res.status === 401 || res.status === 403) {
      clearExtensionSession()
    }
  } catch {
    // Leave any existing blob alone.
  }
}
