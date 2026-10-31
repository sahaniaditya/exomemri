/** Server-side loaders for the notes workspace (server components only). */
import { apiFetch } from '@/lib/api'
import type { NoteTreeItem } from './types'

/** The sidebar tree for a space. `error` distinguishes "empty" from "failed". */
export async function loadNoteTree(
  token: string,
  spaceId: string
): Promise<{ items: NoteTreeItem[]; error: boolean }> {
  try {
    const res = await apiFetch(`/v1/spaces/${spaceId}/notes/tree`, {}, token)
    if (!res.ok) {
      console.error('Failed to load note tree:', res.status)
      return { items: [], error: true }
    }
    const data = (await res.json()) as { items?: NoteTreeItem[] }
    return { items: data.items ?? [], error: false }
  } catch (error) {
    console.error('Failed to load note tree:', error)
    return { items: [], error: true }
  }
}
