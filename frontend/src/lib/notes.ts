/**
 * Per-capture user notebook (TipTap JSON).
 * Server components load via apiFetch; the client saves through the BFF.
 */
import { apiFetch } from '@/lib/api'

export interface SourceNote {
  source_id: string
  content: Record<string, unknown>
  updated_at: string | null
}

export const EMPTY_NOTE_DOC: Record<string, unknown> = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

export async function getSourceNote(
  token: string,
  sourceId: string
): Promise<SourceNote> {
  try {
    const res = await apiFetch(`/v1/sources/${sourceId}/notes`, {}, token)
    if (!res.ok) {
      return { source_id: sourceId, content: EMPTY_NOTE_DOC, updated_at: null }
    }
    return (await res.json()) as SourceNote
  } catch (error) {
    console.error('Failed to load source note:', error)
    return { source_id: sourceId, content: EMPTY_NOTE_DOC, updated_at: null }
  }
}

export interface NoteImageUpload {
  key: string
  upload_url: string
  token: string
  path: string
}
