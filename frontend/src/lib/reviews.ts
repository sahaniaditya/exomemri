/**
 * Product reviews — shapes mirror backend/app/schemas/reviews.py.
 * Authenticated reads use apiFetch; the landing-page list is a cached public fetch.
 */
import { apiFetch } from '@/lib/api'

export interface Review {
  id: string
  rating: number
  body: string
  created_at?: string | null
  updated_at?: string | null
}

export interface PublicReview {
  rating: number
  body: string
  full_name: string
  primary_role: string
}

export async function getMyReview(token: string): Promise<Review | null> {
  try {
    const res = await apiFetch('/v1/reviews/me', {}, token)
    if (res.status === 404) return null
    if (!res.ok) return null
    return (await res.json()) as Review
  } catch (error) {
    console.error('Failed to load review:', error)
    return null
  }
}

/** No auth — public top-N for the landing page. Empty array on any failure.
 * Cached so `/` can still be statically generated; `apiFetch` is `no-store`. */
export async function getTopReviews(): Promise<PublicReview[]> {
  try {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    const res = await fetch(`${backend}/v1/reviews/top`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { items: PublicReview[] }
    return data.items ?? []
  } catch (error) {
    console.error('Failed to load top reviews:', error)
    return []
  }
}
