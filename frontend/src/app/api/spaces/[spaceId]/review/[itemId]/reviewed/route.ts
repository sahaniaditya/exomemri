import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

/** Marks one review item reviewed. Thin proxy over the backend. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ spaceId: string; itemId: string }> }
) {
  const { spaceId, itemId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('atlas_token')?.value

  if (!token) {
    return NextResponse.json(
      { detail: 'Your session has expired. Please log in again.' },
      { status: 401 }
    )
  }

  try {
    const res = await apiFetch(
      `/v1/spaces/${spaceId}/review/${itemId}/reviewed`,
      { method: 'POST' },
      token
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Failed to mark the review item reviewed:', error)
    return NextResponse.json({ detail: 'An unexpected server error occurred.' }, { status: 500 })
  }
}
