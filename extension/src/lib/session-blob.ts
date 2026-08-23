/**
 * The session blob the web app mirrors into its `localStorage` for the
 * extension (see frontend `lib/extension-session.ts`). This module is pure —
 * just the shared key, type, and a defensive validator — so it can be imported
 * from the content-script bridge, the background worker, and the messaging
 * contract alike.
 */

/** Shared key: the page's localStorage key AND the extension storage key. */
export const STORED_SESSION_KEY = "atlas.session"

/**
 * Event the web app dispatches on `window` right after it writes the blob.
 *
 * A same-tab `localStorage` write fires no `storage` event, so without this the
 * bridge would not notice a session change (e.g. a space created on the
 * dashboard) until the tab next became visible — which opening the extension's
 * popup does not do. Keep in sync with `frontend/src/lib/extension-session.ts`.
 */
export const SESSION_UPDATED_EVENT = "atlas:session-updated"

export interface StoredSession {
  version: number
  access_token: string
  refresh_token: string | null
  user: { id: string; email: string }
  space_id: string | null
  space_name: string | null
  /** Access-token expiry, epoch seconds. */
  expires_at: number
  /** When the web app wrote the blob, epoch seconds. */
  updated_at: number
}

/**
 * Validate/normalize an untrusted value (a JSON string from page localStorage
 * or a relayed message) into a `StoredSession`, or `null` if it isn't one.
 * Never trust the page — always run relayed data through this.
 */
export function parseStoredSession(input: unknown): StoredSession | null {
  let raw: unknown = input
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!raw || typeof raw !== "object") return null

  const o = raw as Record<string, unknown>
  const user = o.user as Record<string, unknown> | undefined
  if (typeof o.access_token !== "string" || o.access_token.length === 0) return null
  if (!user || typeof user.id !== "string" || typeof user.email !== "string") return null

  return {
    version: typeof o.version === "number" ? o.version : 1,
    access_token: o.access_token,
    refresh_token: typeof o.refresh_token === "string" ? o.refresh_token : null,
    user: { id: user.id, email: user.email },
    space_id: typeof o.space_id === "string" ? o.space_id : null,
    space_name: typeof o.space_name === "string" ? o.space_name : null,
    expires_at: typeof o.expires_at === "number" ? o.expires_at : 0,
    updated_at: typeof o.updated_at === "number" ? o.updated_at : 0,
  }
}

/**
 * Durable marker the web app stamps into its own `localStorage` (see
 * `frontend/src/lib/extension-session.ts`), independent of whether anyone is
 * signed in.
 *
 * It answers a question the origin alone cannot: "is this page actually the
 * exomemri web app?" Every `localhost` port is a trusted origin in dev, so
 * without this marker an unrelated tab (the backend's `:8000/docs`, say) would
 * look like a signed-out exomemri app and wipe a perfectly good session. Absence
 * of `atlas.session` only means "signed out" on a page carrying this marker.
 */
export const APP_MARKER_KEY = "atlas.app"
