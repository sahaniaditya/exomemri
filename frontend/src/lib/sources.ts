import { apiFetch } from '@/lib/api'

export interface StructuredSummary {
  tldr: string[]
  key_concepts: string[]
  examples: string[]
  interview_points: string[]
}

export interface SummaryResponse {
  summary: string | null
  sections: StructuredSummary | null
  generated: boolean
  model: string | null
  summarized_at: string | null
}

export function splitSummaryParagraphs(summary: string | null | undefined): string[] {
  const prose = summary?.trim() ?? ''
  if (!prose) return []
  return prose.split(/\n\n+/).filter(Boolean)
}

/** Capture-page notes plate: 06 when a prose summary is shown above it, else 05. */
export function captureNotesPlateNum(summary: string | null | undefined): string {
  return splitSummaryParagraphs(summary).length > 0 ? '06' : '05'
}

export function captureSectionPlate(
  index: number,
  summary: string | null | undefined
): string {
  const shift = splitSummaryParagraphs(summary).length > 0 ? 1 : 0
  return String(index + shift).padStart(2, '0')
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export async function getSourceSummary(
  token: string,
  sourceId: string
): Promise<SummaryResponse | null> {
  try {
    const res = await apiFetch(`/v1/sources/${sourceId}/summary`, {}, token)
    if (!res.ok) return null
    const body = (await res.json()) as SummaryResponse
    if (!body.sections) return null
    return body
  } catch (error) {
    console.error('Failed to load source summary:', error)
    return null
  }
}

export async function listSourceMessages(token: string, sourceId: string): Promise<ChatMessage[]> {
  try {
    const res = await apiFetch(`/v1/sources/${sourceId}/messages`, {}, token)
    if (!res.ok) return []
    return ((await res.json()) as { messages: ChatMessage[] }).messages
  } catch (error) {
    console.error('Failed to load source messages:', error)
    return []
  }
}