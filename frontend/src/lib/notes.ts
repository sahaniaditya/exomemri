/**
 * Named note pages (TipTap JSON) on captures and spaces.
 * Server components load via apiFetch; the client saves through the BFF.
 */
import { apiFetch } from '@/lib/api'

export interface NotePage {
  id: string
  title: string
  content: Record<string, unknown>
  sort_order: number
  updated_at: string | null
  source_id?: string
  space_id?: string
}

export type NotesScope =
  | { kind: 'source'; sourceId: string }
  | { kind: 'space'; spaceId: string }

export function notesApiBase(scope: NotesScope): string {
  return scope.kind === 'source'
    ? `/api/sources/${scope.sourceId}`
    : `/api/spaces/${scope.spaceId}`
}

export function notesArtifactUrlPath(scope: NotesScope, key: string): string {
  const encoded = encodeURIComponent(key)
  if (scope.kind === 'source') {
    return `${notesApiBase(scope)}/artifact-url?key=${encoded}`
  }
  return `${notesApiBase(scope)}/note-artifact-url?key=${encoded}`
}

export const EMPTY_NOTE_DOC: Record<string, unknown> = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

/** True when the clipboard is a whole code snippet, not mixed prose + code. */
export function clipboardLooksLikeCode(data: DataTransfer): boolean {
  const types = Array.from(data.types)
  if (types.some(type => /vscode|code\.copymetadata/i.test(type))) return true
  const html = data.getData('text/html').trim()
  if (!html) return false
  const leftover = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?(html|head|body|meta|link|span|div|br|fragment)[^>]*>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .trim()
  return /^<(pre|code)\b[\s\S]*<\/(pre|code)>\s*$/i.test(leftover)
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

export async function listSpaceNotes(
  token: string,
  spaceId: string
): Promise<{ items: NotePage[]; error: boolean }> {
  try {
    const res = await apiFetch(`/v1/spaces/${spaceId}/notes`, {}, token)
    if (!res.ok) {
      console.error('Failed to load space notes:', res.status)
      return { items: [], error: true }
    }
    const data = (await res.json()) as { items?: NotePage[] }
    return { items: data.items ?? [], error: false }
  } catch (error) {
    console.error('Failed to load space notes:', error)
    return { items: [], error: true }
  }
}

export interface NoteImageUpload {
  key: string
  upload_url: string
  token: string
  path: string
}
