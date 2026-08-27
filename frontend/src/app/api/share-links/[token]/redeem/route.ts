import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

/** Redeem a shareable capture link (any logged-in user). */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: shareToken } = await params
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
      `/v1/share-links/${encodeURIComponent(shareToken)}/redeem`,
      { method: 'POST' },
      token
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Failed to redeem share link:', error)
    return NextResponse.json({ detail: 'An unexpected server error occurred.' }, { status: 500 })
  }
}
