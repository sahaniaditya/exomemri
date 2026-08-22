/**
 * Read-only space sharing, as returned by the backend.
 *
 * Shapes mirror `CollaboratorResponse` / `SharedSpaceSummary` in
 * `backend/app/schemas/sharing.py`. Hand-written per feature, following
 * `lib/spaces.ts` — there is no generated database types file.
 */
import { apiFetch } from '@/lib/api'

export interface Collaborator {
  user_id: string
  username: string
  full_name: string | null
  created_at: string | null
}

export interface SharedSpaceSummary {
  id: string
  name: string
  slug: string
  owner_username: string | null
  shared_at: string | null
}

export async function listCollaborators(token: string, spaceId: string): Promise<Collaborator[]> {
  try {
    const res = await apiFetch(`/v1/spaces/${spaceId}/collaborators`, {}, token)
    if (!res.ok) return []
    return ((await res.json()) as { collaborators: Collaborator[] }).collaborators
  } catch (error) {
    console.error('Failed to load collaborators:', error)
    return []
  }
}

export async function listSharedWithMe(token: string): Promise<SharedSpaceSummary[]> {
  try {
    const res = await apiFetch('/v1/shared-with-me', {}, token)
    if (!res.ok) return []
    return ((await res.json()) as { spaces: SharedSpaceSummary[] }).spaces
  } catch (error) {
    console.error('Failed to load spaces shared with you:', error)
    return []
  }
}
