
import { NextResponse } from 'next/server'
import { establishSession } from '../../../../lib/auth-session'


export async function POST(request: Request) {
  const { access_token, refresh_token } = await request.json()

  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: 'Missing tokens' }, { status: 400 })
  }

  try {
    const redirectTo = await establishSession(access_token, refresh_token)
    return NextResponse.json({ redirectTo, access_token, refresh_token })
  } catch (error) {
    console.error('Session establishment failed:', error)
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }
}