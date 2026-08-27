/**
 * Per-capture named note pages (TipTap JSON).
 * Server components load via apiFetch; the client saves through the BFF.
 */
import { apiFetch } from '@/lib/api'

export interface NotePage {
  id: string
  source_id: string
  title: string
  content: Record<string, unknown>
  sort_order: number
  updated_at: string | null
}

export const EMPTY_NOTE_DOC: Record<string, unknown> = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

export async function listSourceNotes(
  token: string,
  sourceId: string
): Promise<{ items: NotePage[]; error: boolean }> {
  try {
    const res = await apiFetch(`/v1/sources/${sourceId}/notes`, {}, token)
    if (!res.ok) {
      console.error('Failed to load source notes:', res.status)
      return { items: [], error: true }
    }
    const data = (await res.json()) as { items?: NotePage[] }
    return { items: data.items ?? [], error: false }
  } catch (error) {
    console.error('Failed to load source notes:', error)
    return { items: [], error: true }
  }
}

export interface NoteImageUpload {
  key: string
  upload_url: string
  token: string
  path: string
}
