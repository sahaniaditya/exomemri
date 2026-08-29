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