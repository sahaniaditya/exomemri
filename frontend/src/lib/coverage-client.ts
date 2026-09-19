import type { CoverageResponse } from '@/lib/coverage'

export type CoverageRegenerateResult =
  | { ok: true; coverage: CoverageResponse }
  | { ok: false; message: string; status: number }

const REGENERATE_ERRORS: Record<number, string> = {
  401: 'Your session expired. Reload the page and sign in again.',
  402: "You're out of credits. Coverage refresh unlocks when your monthly allowance resets.",
  429: 'Coverage can be refreshed once an hour. Try again later.',
}

function coverageRegenerateErrorMessage(status: number): string {
  return REGENERATE_ERRORS[status] ?? 'Could not refresh coverage. Try again in a moment.'
}

/** In-memory lock so unmounting mid-POST cannot start a second paid regen. */
const inFlight = new Set<string>()

/** Client-side: POST through the BFF proxy. Consumes one credit on the backend. */
export async function regenerateSpaceCoverage(
  spaceId: string
): Promise<CoverageRegenerateResult> {
  if (inFlight.has(spaceId)) {
    return {
      ok: false,
      message: 'Coverage is already being calculated for this space.',
      status: 409,
    }
  }

  inFlight.add(spaceId)
  try {
    const res = await fetch(`/api/spaces/${spaceId}/coverage`, { method: 'POST' })
    if (!res.ok) {
      return {
        ok: false,
        message: coverageRegenerateErrorMessage(res.status),
        status: res.status,
      }
    }
    return { ok: true, coverage: (await res.json()) as CoverageResponse }
  } finally {
    inFlight.delete(spaceId)
  }
}
