import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
 
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('atlas_token')?.value
 
  if (!token) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 })
  }
 
  try {
    const res = await apiFetch('/api/v1/auth/me', {}, token)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Failed to load profile:', error)
    return NextResponse.json({ detail: 'Failed to load profile details' }, { status: 500 })
  }
}