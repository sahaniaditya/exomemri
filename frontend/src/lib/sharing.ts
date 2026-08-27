/**
 * Read-only capture sharing, as returned by the backend.
 *
 * Shapes mirror `CollaboratorResponse` / `SharedSourceSummary` /
 * `ShareLinkStatusResponse` in `backend/app/schemas/sharing.py`.
 */
import { apiFetch } from '@/lib/api'
import type { ProcessingStatus, SourceType } from '@/lib/spaces'

export interface Collaborator {
  user_id: string
  username: string
  full_name: string | null
  created_at: string | null
}

export interface SharedSourceSummary {
  source_id: string
  title: string
  type: SourceType
  url: string | null
  author: string | null
  captured_at: string | null
  processing_status: ProcessingStatus
  space_id: string
  space_name: string
  owner_username: string | null
  shared_at: string | null
}

export interface ShareLinkStatus {
  enabled: boolean
  token: string | null
  path: string | null
  created_at: string | null
}

export interface ShareLink {
  token: string
  path: string
  created_at: string
}

export interface RedeemShareLinkResult extends SharedSourceSummary {
  is_owner: boolean
}

/** Allowlisted post-login return path for share links only. */
export const SHARE_LINK_NEXT_RE = /^\/s\/[A-Za-z0-9_-]+$/

export function isAllowedShareReturnPath(path: string | null | undefined): path is string {
  return typeof path === 'string' && SHARE_LINK_NEXT_RE.test(path)
}

export async function listCollaborators(
  token: string,
  sourceId: string
): Promise<Collaborator[]> {
  try {
    const res = await apiFetch(`/v1/sources/${sourceId}/collaborators`, {}, token)
    if (!res.ok) return []
    return ((await res.json()) as { collaborators: Collaborator[] }).collaborators
  } catch (error) {
    console.error('Failed to load collaborators:', error)
    return []
  }
}

export async function listSharedWithMe(token: string): Promise<SharedSourceSummary[]> {
  try {
    const res = await apiFetch('/v1/shared-with-me', {}, token)
    if (!res.ok) return []
    return ((await res.json()) as { sources: SharedSourceSummary[] }).sources
  } catch (error) {
    console.error('Failed to load captures shared with you:', error)
    return []
  }
}

export async function getShareLinkStatus(
  token: string,
  sourceId: string
): Promise<ShareLinkStatus> {
  try {
    const res = await apiFetch(`/v1/sources/${sourceId}/share-link`, {}, token)
    if (!res.ok) return { enabled: false, token: null, path: null, created_at: null }
    return (await res.json()) as ShareLinkStatus
  } catch (error) {
    console.error('Failed to load share link status:', error)
    return { enabled: false, token: null, path: null, created_at: null }
  }
}
