/**
 * Monthly credit quota, as returned by the backend.
 *
 * Shape mirrors `CreditsBalance` in `backend/app/schemas/credits.py`.
 */
import { apiFetch } from '@/lib/api'

export interface CreditsBalance {
  balance: number
  monthly_allowance: number
  ask_units: number
  period_end: string
}

export function formatCredits(balance: number): string {
  return `${balance} credit${balance === 1 ? '' : 's'}`
}

export async function getCredits(token: string): Promise<CreditsBalance | null> {
  try {
    const res = await apiFetch('/v1/credits', {}, token)
    if (!res.ok) return null
    return (await res.json()) as CreditsBalance
  } catch (error) {
    console.error('Failed to load credits:', error)
    return null
  }
}
