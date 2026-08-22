import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

/**
 * One space's daily review queue. A thin proxy over the backend so the
 * browser never needs the bearer token — it stays in the httpOnly cookie.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('atlas_token')?.value

  if (!token) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 })
  }

  try {
    const res = await apiFetch(`/v1/spaces/${spaceId}/review/today`, {}, token)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Failed to load the review queue:', error)
    return NextResponse.json({ detail: 'Failed to load your review queue' }, { status: 500 })
  }
}
