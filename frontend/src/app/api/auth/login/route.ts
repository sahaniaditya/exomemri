import { NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api'
import { establishSession } from '@/lib/auth-session'

function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return 'unknown'
}

function errorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback
  const record = data as Record<string, unknown>
  if (typeof record.detail === 'string') return record.detail
  const err = record.error
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return fallback
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    const res = await apiFetch('/v1/auth/login', {
      method: 'POST',
      headers: {
        'X-Forwarded-For': clientIpFromRequest(request),
      },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      const fallback =
        res.status === 429
          ? 'Too many login attempts. Please try again later.'
          : 'Invalid credentials.'
      return NextResponse.json(
        { detail: errorMessage(data, fallback) },
        { status: res.status },
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
