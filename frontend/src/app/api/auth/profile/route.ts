import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
 
export async function POST(request: Request) {
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
      '/api/v1/auth/profile',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      token
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Profile submission failed:', error)
    return NextResponse.json(
      { detail: 'An unexpected server error occurred.' },
      { status: 500 }
    )
  }
}