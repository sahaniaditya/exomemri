/**
 * Persistent home for the logged-in session inside the extension.
 *
 * Uses `browser.storage.local` (not `.session`) so the session survives both
 * MV3 service-worker teardown and browser restarts — mirroring the web app,
 * which keeps the user signed in across restarts. The blob originates from the
 * web app's localStorage, relayed here by the bridge content script.
 */
import { browser } from "wxt/browser"

import { parseStoredSession, STORED_SESSION_KEY, type StoredSession } from "./session-blob"

export async function readSession(): Promise<StoredSession | null> {
  const stored = await browser.storage.local.get(STORED_SESSION_KEY)
  return parseStoredSession(stored[STORED_SESSION_KEY])
}

export async function writeSession(blob: StoredSession): Promise<void> {
  await browser.storage.local.set({ [STORED_SESSION_KEY]: blob })
}

/**
 * Erase every trace of the signed-in user from the extension.
 *
 * Sweeps the whole `atlas.*` namespace rather than just the session key: a
 * sign-out must leave nothing behind — no email, no active space, no token —
 * and that stays true if another `atlas.*` key is ever added. Spaces are never
 * persisted (the popup lists them live), so this is the complete set.
 */
export async function clearSession(): Promise<void> {
  const all = await browser.storage.local.get(null)
  const owned = Object.keys(all).filter((key) => key.startsWith("atlas."))
  await browser.storage.local.remove(owned.length > 0 ? owned : STORED_SESSION_KEY)
}

/** The access token to attach as a Bearer header, or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const session = await readSession()
  return session?.access_token ?? null
}
