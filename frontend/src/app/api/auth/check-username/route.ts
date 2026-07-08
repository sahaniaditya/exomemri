import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
 
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username')
 
  if (!username) {
    return NextResponse.json({ error: 'Missing username' }, { status: 400 })
  }
 
  const cookieStore = await cookies()
  const token = cookieStore.get('atlas_token')?.value
 
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
 
  try {
    const res = await apiFetch(
      `/api/v1/auth/check-username?username=${encodeURIComponent(username)}`,
      {},
      token
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Username check failed:', error)
    return NextResponse.json({ error: 'Network validation error' }, { status: 500 })
  }
}