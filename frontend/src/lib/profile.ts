/** Shape returned by `GET /v1/auth/me` (proxied through `/api/auth/me`). */
export interface Profile {
  id?: string
  email?: string
  full_name: string
  username: string
  primary_role: string
  domain_of_focus: string
  referral_source?: string
  current_streak?: number
  longest_streak?: number
  last_active_date?: string | null
  updated_at?: string
}

export function firstName(profile: Profile | null): string {
  return profile?.full_name?.trim().split(/\s+/)[0] || 'there'
}

export function initial(profile: Profile | null): string {
  return (profile?.full_name?.trim()[0] || profile?.username?.[0] || 'A').toUpperCase()
}

export function streakDays(profile: Profile | null): number {
  return profile?.current_streak ?? 0
}

export function longestStreak(profile: Profile | null): number {
  return profile?.longest_streak ?? 0
}

/** Calendar date from a `YYYY-MM-DD` or ISO timestamp, local (not UTC midnight). */
export function formatProfileDate(value: string | null | undefined): string | null {
  if (!value) return null
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
