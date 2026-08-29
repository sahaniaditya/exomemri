import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

/**
 * Infer (or refresh) the space syllabus. Consumes one credit on the backend.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('atlas_token')?.value

  if (!token) {
    return NextResponse.json(
      { detail: 'Your session has expired. Please log in again.' },
      { status: 401 }
    )
  }

  try {
    const res = await apiFetch(`/v1/spaces/${spaceId}/coverage`, { method: 'POST' }, token)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Coverage regenerate failed:', error)
    return NextResponse.json({ detail: 'An unexpected server error occurred.' }, { status: 500 })
  }
}
