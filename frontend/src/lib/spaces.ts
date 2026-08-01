/**
 * Learning Spaces and captured sources, as returned by the backend.
 *
 * Shapes mirror `SpaceSummary` / `SourceSummary` in
 * `backend/app/schemas/spaces.py`. Hand-written per feature, following
 * `lib/profile.ts` — there is no generated database types file.
 */
import { apiFetch } from '@/lib/api'

/** Matches `SourceType` in backend/app/schemas/common.py. */
export type SourceType = 'youtube' | 'article' | 'ai_chat' | 'pdf' | 'note'

export interface SourceCounts {
  youtube: number
  article: number
  ai_chat: number
  pdf: number
  note: number
  total: number
}

export interface Space {
  id: string
  name: string
  slug: string
  goal_text: string | null
  created_at: string | null
  last_captured_at: string | null
  source_counts: SourceCounts
}

export interface Source {
  id: string
  space_id: string
  space_name: string | null
  type: SourceType
  title: string
  url: string | null
  author: string | null
  captured_at: string | null
  processing_status: string
}

/** The caller's spaces, newest activity first. Empty on any failure. */
export async function listSpaces(token: string): Promise<Space[]> {
  try {
    const res = await apiFetch('/v1/spaces', {}, token)
    if (!res.ok) return []
    return ((await res.json()) as { spaces: Space[] }).spaces
  } catch (error) {
    console.error('Failed to load spaces:', error)
    return []
  }
}

/** Recent captures across every space. Empty on any failure. */
export async function listRecentSources(token: string, limit = 8): Promise<Source[]> {
  try {
    const res = await apiFetch(`/v1/sources?limit=${limit}`, {}, token)
    if (!res.ok) return []
    return ((await res.json()) as { sources: Source[] }).sources
  } catch (error) {
    console.error('Failed to load recent captures:', error)
    return []
  }
}
