import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

/**
 * Shareable link for one capture (owner-only, enforced by the backend).
 * Thin proxy so the browser never needs the bearer token.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('atlas_token')?.value

  if (!token) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 })
  }

  try {
    const res = await apiFetch(`/v1/sources/${sourceId}/share-link`, {}, token)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Failed to load share link:', error)
    return NextResponse.json({ detail: 'Failed to load share link' }, { status: 500 })
  }
}

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params
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
      `/v1/sources/${sourceId}/share-link`,
      { method: 'PUT' },
      token
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Failed to create share link:', error)
    return NextResponse.json({ detail: 'An unexpected server error occurred.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params
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
      `/v1/sources/${sourceId}/share-link`,
      { method: 'DELETE' },
      token
    )
    if (res.status === 204) return new NextResponse(null, { status: 204 })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Failed to revoke share link:', error)
    return NextResponse.json({ detail: 'An unexpected server error occurred.' }, { status: 500 })
  }
}
