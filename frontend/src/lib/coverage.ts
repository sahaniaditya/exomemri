/**
 * Coverage % per space, as returned by the backend.
 *
 * Shapes mirror `CoverageResponse` in `backend/app/schemas/coverage.py`.
 * Hand-written per feature, following `lib/review.ts` — there is no generated
 * database types file.
 */
import { apiFetch } from '@/lib/api'

export interface SyllabusTopic {
  label: string
  covered: boolean
}

export interface CoverageResponse {
  space_id: string
  coverage_pct: number | null
  topics: SyllabusTopic[]
  generated_at: string | null
}

const EMPTY_COVERAGE: Omit<CoverageResponse, 'space_id'> = {
  coverage_pct: null,
  topics: [],
  generated_at: null,
}

export async function getSpaceCoverage(
  token: string,
  spaceId: string
): Promise<CoverageResponse> {
  try {
    const res = await apiFetch(`/v1/spaces/${spaceId}/coverage`, {}, token)
    if (!res.ok) return { space_id: spaceId, ...EMPTY_COVERAGE }
    return (await res.json()) as CoverageResponse
  } catch (error) {
    console.error('Failed to load space coverage:', error)
    return { space_id: spaceId, ...EMPTY_COVERAGE }
  }
}
