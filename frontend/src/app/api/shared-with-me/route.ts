import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

/** Captures another Atlas user has shared read-only access to with the caller. */
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('atlas_token')?.value

  if (!token) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 })
  }

  try {
    const res = await apiFetch('/v1/shared-with-me', {}, token)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Failed to load captures shared with you:', error)
    return NextResponse.json(
      { detail: 'Failed to load captures shared with you' },
      { status: 500 }
    )
  }
}
