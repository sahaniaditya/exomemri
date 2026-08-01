/** Shape returned by `GET /v1/auth/me` (proxied through `/api/auth/me`). */
export interface Profile {
  full_name: string
  username: string
  primary_role: string
  domain_of_focus: string
  referral_source?: string
}

export function firstName(profile: Profile | null): string {
  return profile?.full_name?.trim().split(/\s+/)[0] || 'there'
}

export function initial(profile: Profile | null): string {
  return (profile?.full_name?.trim()[0] || profile?.username?.[0] || 'A').toUpperCase()
}
