import { NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api'

export async function POST(request: Request) {
  try {
    const { token_hash, password } = await request.json()
    if (!token_hash || !password) {
      return NextResponse.json({ detail: 'Missing token or password.' }, { status: 400 })
    }

    const res = await apiFetch('/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token_hash, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { detail: data.detail || 'Could not reset password.' },
        { status: res.status },
      )
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Reset-password failed:', error)
    return NextResponse.json({ detail: 'Could not reset password.' }, { status: 500 })
  }
}