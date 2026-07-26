/**
 * Session state, derived from the blob the web app mirrors into the extension.
 *
 * The background worker is the only session holder. The blob (user + tokens +
 * active space) is persisted by the bridge content script into
 * `browser.storage.local` (see lib/session-store); this module reads it and
 * shapes it into the `SessionResponse` the popup already understands. No
 * `GET /v1/session` on the hot path — initialization is local and instant.
 */
import { api } from "../lib/api"
import type { SessionResponse } from "../lib/contracts"
import { readSession, writeSession } from "../lib/session-store"

/** Build the current session from the stored blob; throws if signed out. */
export async function fetchSession(): Promise<SessionResponse> {
  const stored = await readSession()
  if (!stored) throw new Error("Signed out")
  return {
    user: { id: stored.user.id, email: stored.user.email },
    active_space: stored.space_id
      ? { id: stored.space_id, name: stored.space_name ?? "" }
      : null,
  }
}

/** Active space from the stored blob, or null. */
export async function getActiveSpace(): Promise<SessionResponse["active_space"]> {
  const session = await fetchSession()
  return session.active_space
}

/** Active space id, or throw if signed out / no active space. */
export async function requireActiveSpaceId(): Promise<string> {
  const stored = await readSession()
  if (!stored?.space_id) throw new Error("No active learning space")
  return stored.space_id
}

/**
 * Set the active space server-side, then refresh the stored blob from the
 * authenticated backend so the local copy matches the source of truth.
 */
export async function setActiveSpace(spaceId: string): Promise<void> {
  await api.setActiveSpace(spaceId)
  const remote = await api.getSession()
  const stored = await readSession()
  if (stored) {
    await writeSession({
      ...stored,
      space_id: remote.active_space?.id ?? null,
      space_name: remote.active_space?.name ?? null,
    })
  }
}
