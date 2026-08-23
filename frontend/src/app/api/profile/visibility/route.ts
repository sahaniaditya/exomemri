import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

/** The caller's own public-profile visibility. Thin proxy over the backend. */
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('atlas_token')?.value

  if (!token) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 })
  }

  try {
    const res = await apiFetch('/v1/profile/visibility', {}, token)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Failed to load profile visibility:', error)
    return NextResponse.json({ detail: 'Failed to load profile visibility' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('atlas_token')?.value

  if (!token) {
    return NextResponse.json(
      { detail: 'Your session has expired. Please log in again.' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const res = await apiFetch(
      '/v1/profile/visibility',
      { method: 'PUT', body: JSON.stringify(body) },
      token
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Failed to update profile visibility:', error)
    return NextResponse.json({ detail: 'An unexpected server error occurred.' }, { status: 500 })
  }
}
