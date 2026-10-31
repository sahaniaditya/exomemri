/** Shapes mirror backend/app/schemas/note_workspace.py. */

export interface NoteTreeItem {
  id: string
  title: string
  icon: string | null
  parent_id: string | null
  sort_order: number
  updated_at: string | null
}

export interface NoteTrashItem {
  id: string
  title: string
  icon: string | null
  parent_id: string | null
  deleted_at: string | null
}

export interface NoteSearchHit {
  id: string
  title: string
  icon: string | null
  snippet: string
}

export interface WorkspacePage {
  id: string
  space_id: string
  title: string
  content: Record<string, unknown>
  icon: string | null
  cover_key: string | null
  full_width: boolean
  parent_id: string | null
  sort_order: number
  created_at: string | null
  updated_at: string | null
}

export interface OutgoingNoteLink {
  type: 'source' | 'note'
  id: string
  title: string
}

export interface IncomingNoteLink {
  id: string
  title: string
  icon: string | null
}

export interface NoteLinks {
  outgoing: OutgoingNoteLink[]
  incoming: IncomingNoteLink[]
}

/** Partial update accepted by PATCH /notes/{id}. Omitted keys are untouched. */
export interface NotePatch {
  title?: string
  content?: Record<string, unknown>
  icon?: string | null
  cover_key?: string | null
  full_width?: boolean
  parent_id?: string | null
  sort_order?: number
  expected_updated_at?: string
}

export const MAX_TITLE_LENGTH = 120

export function notePath(spaceId: string, noteId: string): string {
  return `/dashboard/spaces/${spaceId}/notes/${noteId}`
}

export function sourcePath(spaceId: string, sourceId: string): string {
  return `/dashboard/spaces/${spaceId}/sources/${sourceId}`
}
