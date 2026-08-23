/**
 * Read-only capture sharing, as returned by the backend.
 *
 * Shapes mirror `CollaboratorResponse` / `SharedSourceSummary` in
 * `backend/app/schemas/sharing.py`. Hand-written per feature, following
 * `lib/spaces.ts` — there is no generated database types file.
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
