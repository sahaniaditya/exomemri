/**
 * Session state, derived from the blob the web app mirrors into the extension.
 *
 * The background worker is the only session holder. The blob (user + tokens +
 * active space) is persisted by the bridge content script into
 * `browser.storage.local` (see lib/session-store); this module reads it and
 * shapes it into the `SessionResponse` the popup already understands. No
 * `GET /v1/session` on the hot path — initialization is local and instant.
 */
import { api, ApiError } from "../lib/api"
import type { SessionResponse, SpaceSummary } from "../lib/contracts"
import { clearSession, readSession, writeSession } from "../lib/session-store"

const SIGNED_OUT = "Signed out"

/**
 * Clock skew allowance on the mirrored token's expiry. The web app re-mirrors
 * well before this fires (see frontend `SessionSync`); this is the backstop for
 * a blob left behind by a browser that was closed for an hour.
 */
const EXPIRY_SKEW_SECONDS = 30

/**
 * Wrap a call that needs the stored token: a 401 means the mirrored token is no
 * longer good, so drop it rather than leaving the popup showing a stale
 * identity next to an error it cannot explain.
 */
async function withSessionInvalidation<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      await clearSession()
      throw new Error(SIGNED_OUT, { cause: error })
    }
    throw error
  }
}

/** Build the current session from the stored blob; throws if signed out. */
export async function fetchSession(): Promise<SessionResponse> {
  const stored = await readSession()
  if (!stored) throw new Error(SIGNED_OUT)

  // An expired mirror is not a session. Treating it as one is what produced a
  // popup showing an email next to "couldn't load spaces".
  const now = Math.floor(Date.now() / 1000)
  if (stored.expires_at > 0 && stored.expires_at + EXPIRY_SKEW_SECONDS < now) {
    await clearSession()
    throw new Error(SIGNED_OUT)
  }

  // Belt-and-braces. The web app now announces its writes so the bridge relays
  // a newly created space immediately, but if that relay never arrived (a blob
  // written by an older build, a tab that closed mid-flight) the popup would be
  // stuck with Save disabled. Only the no-active-space case pays for a request;
  // the normal path stays a local, instant read.
  if (!stored.space_id) {
    const remote = await withSessionInvalidation(() => api.getSession()).catch(
      (error: unknown) => {
        if (error instanceof Error && error.message === SIGNED_OUT) throw error
        return null
      },
    )
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
  const { active_space } = await fetchSession()
  if (!active_space) throw new Error("No active learning space")
  return active_space.id
}

/**
 * The user's spaces, for the popup's picker. Unlike the session, this is a live
 * call — spaces are created on the web app and the popup should see new ones
 * without waiting for a session re-sync.
 */
export async function listSpaces(): Promise<SpaceSummary[]> {
  const resp = await withSessionInvalidation(() => api.listSpaces())
  return resp.spaces
}

/**
 * Set the active space server-side, then refresh the stored blob from the
 * authenticated backend so the local copy matches the source of truth. The
 * backend rejects a space the caller doesn't own, so errors propagate.
 */
export async function setActiveSpace(spaceId: string): Promise<void> {
  await withSessionInvalidation(() => api.setActiveSpace(spaceId))
  const remote = await withSessionInvalidation(() => api.getSession())
  const stored = await readSession()
  if (stored) {
    await writeSession({
      ...stored,
      space_id: remote.active_space?.id ?? null,
      space_name: remote.active_space?.name ?? null,
    })
  }
}
