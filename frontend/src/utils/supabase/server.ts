import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  // 1. Await the async cookies() call from Next.js
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // 2. Use modern getAll helper
        getAll() {
          return cookieStore.getAll()
        },
        // 3. Use modern setAll helper
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            // The `setAll` method can be called from a Server Component.
            // This can be ignored if your middleware handles token refreshing.
          }
        },
      },
    }
  )
}