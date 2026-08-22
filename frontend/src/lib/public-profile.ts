/**
 * Public learning profiles, as returned by the backend.
 *
 * Shapes mirror `PublicProfileResponse` / `ProfileVisibilityResponse` in
 * `backend/app/schemas/profile.py`. Hand-written per feature, following
 * `lib/profile.ts` — there is no generated database types file.
 */
import { apiFetch } from '@/lib/api'

export interface PublicSpaceSummary {
  name: string
  coverage_pct: number | null
  source_count: number
}

export interface PublicProfile {
  username: string
  full_name: string
  current_streak: number
  longest_streak: number
  spaces: PublicSpaceSummary[]
}

/** No auth — this is the one public read in the app. Null on any failure
 * or 404 (unknown username, or the owner hasn't opted in). */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  try {
    const res = await apiFetch(`/v1/profiles/${encodeURIComponent(username)}`)
    if (!res.ok) return null
    return (await res.json()) as PublicProfile
  } catch (error) {
    console.error('Failed to load public profile:', error)
    return null
  }
}

export async function getProfileVisibility(token: string): Promise<boolean> {
  try {
    const res = await apiFetch('/v1/profile/visibility', {}, token)
    if (!res.ok) return false
    return ((await res.json()) as { profile_public: boolean }).profile_public
  } catch (error) {
    console.error('Failed to load profile visibility:', error)
    return false
  }
}
