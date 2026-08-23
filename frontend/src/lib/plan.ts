/**
 * Study plan, as returned by the backend.
 *
 * Shapes mirror `StudyPlanResponse` in `backend/app/schemas/plan.py`.
 * Hand-written per feature, following `lib/coverage.ts` — there is no
 * generated database types file.
 */
import { apiFetch } from '@/lib/api'

export type PlanItemKind = 'uncovered_topic'

export interface PlanItem {
  kind: PlanItemKind
  title: string
  rationale: string
}

export interface StudyPlanResponse {
  space_id: string
  items: PlanItem[]
  generated_at: string
}

export async function getStudyPlan(token: string, spaceId: string): Promise<PlanItem[]> {
  try {
    const res = await apiFetch(`/v1/spaces/${spaceId}/plan`, {}, token)
    if (!res.ok) return []
    return ((await res.json()) as StudyPlanResponse).items
  } catch (error) {
    console.error('Failed to load the study plan:', error)
    return []
  }
}
