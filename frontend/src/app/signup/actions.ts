'use server'
import { cookies } from 'next/headers'

export async function markSignupPending(email: string) {
  const cookieStore = await cookies()
  cookieStore.set('signup_pending', email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/signup/verify',
    maxAge: 60 * 10,
  })
}

// NEW — deletes the cookie. Must be called from a Server Action context,
// so it's invoked from the client component below, not from page.tsx render.
export async function consumeSignupPending() {
  const cookieStore = await cookies()
  cookieStore.delete('signup_pending')
}