/**
 * Session state — the background worker is the ONLY holder of it.
 *
 * The MV3 service worker is ephemeral, so the active space is cached in
 * `browser.storage.session` (cleared when the browser closes) rather than a
 * module variable that would be lost when the worker is torn down.
 */
import { browser } from "wxt/browser"

import { api } from "../lib/api"
import type { SessionResponse, Space } from "../lib/contracts"

const ACTIVE_SPACE_KEY = "atlas.activeSpace"

async function cacheActiveSpace(space: Space | null): Promise<void> {
  await browser.storage.session.set({ [ACTIVE_SPACE_KEY]: space })
}

async function readCachedActiveSpace(): Promise<Space | null> {
  const stored = await browser.storage.session.get(ACTIVE_SPACE_KEY)
  return (stored[ACTIVE_SPACE_KEY] as Space | null) ?? null
}

/** Fetch the session from the API and refresh the cached active space. */
export async function fetchSession(): Promise<SessionResponse> {
  const session = await api.getSession()
  await cacheActiveSpace(session.active_space ?? null)
  return session
}

/** Active space, using the cache first and falling back to the API. */
export async function getActiveSpace(): Promise<Space | null> {
  const cached = await readCachedActiveSpace()
  if (cached) return cached
  const session = await fetchSession()
  return session.active_space ?? null
}

/** Active space id, or throw if signed out / no active space. */
export async function requireActiveSpaceId(): Promise<string> {
  const space = await getActiveSpace()
  if (!space) throw new Error("No active learning space")
  return space.id
}

/** Set the active space server-side and refresh the cache. */
export async function setActiveSpace(spaceId: string): Promise<void> {
  await api.setActiveSpace(spaceId)
  await fetchSession()
}
