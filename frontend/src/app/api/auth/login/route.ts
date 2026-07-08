import { NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api'
import { establishSession } from '@/lib/auth-session'
 
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
 
    const res = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
 
    if (!res.ok) {
      return NextResponse.json(
        { detail: data.detail || 'Invalid credentials.' },
        { status: res.status }
      )
    }
 
    // Same profile-status check + httpOnly cookie settings as the
    // OAuth callback and email-verification flows — one source of truth.
    const redirectTo = await establishSession(data.access_token, data.refresh_token)
 
    return NextResponse.json({
      redirectTo,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    })
  } catch (error) {
    console.error('Login failed:', error)
    return NextResponse.json({ detail: 'Login failed. Please try again.' }, { status: 500 })
  }
}