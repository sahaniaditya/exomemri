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
import type { SessionResponse, SpaceSummary } from "../lib/contracts"
import { readSession, writeSession } from "../lib/session-store"

/** Build the current session from the stored blob; throws if signed out. */
export async function fetchSession(): Promise<SessionResponse> {
  const stored = await readSession()
  if (!stored) throw new Error("Signed out")

  // Belt-and-braces. The web app now announces its writes so the bridge relays
  // a newly created space immediately, but if that relay never arrived (a blob
  // written by an older build, a tab that closed mid-flight) the popup would be
  // stuck with Save disabled. Only the no-active-space case pays for a request;
  // the normal path stays a local, instant read.
  if (!stored.space_id) {
    const remote = await api.getSession().catch(() => null)
    if (remote?.active_space) {
      await writeSession({
        ...stored,
        space_id: remote.active_space.id,
        space_name: remote.active_space.name,
      })
      return remote
    }
  }

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
 * The user's spaces, for the popup's picker. Unlike the session, this is a live
 * call — spaces are created on the web app and the popup should see new ones
 * without waiting for a session re-sync.
 */
export async function listSpaces(): Promise<SpaceSummary[]> {
  const resp = await api.listSpaces()
  return resp.spaces
}

/**
 * Set the active space server-side, then refresh the stored blob from the
 * authenticated backend so the local copy matches the source of truth. The
 * backend rejects a space the caller doesn't own, so errors propagate.
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
