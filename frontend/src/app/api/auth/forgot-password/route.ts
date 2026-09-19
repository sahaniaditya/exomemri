import { NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ detail: 'Email is required.' }, { status: 400 })
    }

    const res = await apiFetch('/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })

    // Return the same generic response regardless of outcome so the
    // frontend never learns whether the account exists, and only surface
    // a real error for rate limiting.
    if (res.status === 429) {
      return NextResponse.json({ detail: 'Too many requests.' }, { status: 429 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Forgot-password failed:', error)
    // Still return a generic success shape — don't leak backend errors.
    return NextResponse.json({ ok: true })
  }
}