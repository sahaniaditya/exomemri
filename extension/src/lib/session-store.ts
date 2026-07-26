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

export async function clearSession(): Promise<void> {
  await browser.storage.local.remove(STORED_SESSION_KEY)
}

/** The access token to attach as a Bearer header, or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const session = await readSession()
  return session?.access_token ?? null
}
