/**
 * Daily review queue, as returned by the backend.
 *
 * Shapes mirror `ReviewItem` / `ReviewQueueResponse` in
 * `backend/app/schemas/review.py`. Hand-written per feature, following
 * `lib/spaces.ts` — there is no generated database types file.
 */
import { apiFetch } from '@/lib/api'

export interface ReviewItem {
  id: string
  source_id: string
  source_title: string
  space_id: string
  prompt_text: string
  last_reviewed_at: string | null
}

export interface ReviewQueueResponse {
  items: ReviewItem[]
  total_pending: number
}

export async function getReviewQueue(
  token: string,
  spaceId: string
): Promise<ReviewQueueResponse> {
  try {
    const res = await apiFetch(`/v1/spaces/${spaceId}/review/today`, {}, token)
    if (!res.ok) return { items: [], total_pending: 0 }
    return (await res.json()) as ReviewQueueResponse
  } catch (error) {
    console.error('Failed to load the review queue:', error)
    return { items: [], total_pending: 0 }
  }
}
