/**
 * Browser-side client for the notes workspace. Calls only the local BFF
 * (`/api/spaces/...`), never the backend directly.
 */
import type {
  NoteLinks,
  NotePatch,
  NoteSearchHit,
  NoteTrashItem,
  NoteTreeItem,
  WorkspacePage,
} from './types'

export class NotesApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(status: number, message: string, code: string | null = null) {
    super(message)
    this.name = 'NotesApiError'
    this.status = status
    this.code = code
  }

  get isConflict(): boolean {
    return this.status === 409
  }
}

const base = (spaceId: string) => `/api/spaces/${spaceId}/notes`

async function errorFrom(res: Response): Promise<NotesApiError> {
  let message = `Request failed (${res.status})`
  let code: string | null = null
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string }
      detail?: unknown
    }
    if (body.error?.message) message = body.error.message
    else if (typeof body.detail === 'string') message = body.detail
    code = body.error?.code ?? null
  } catch {
    // Non-JSON error body; keep the generic message.
  }
  return new NotesApiError(res.status, message, code)
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw await errorFrom(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
})

export async function fetchTree(spaceId: string): Promise<NoteTreeItem[]> {
  const data = await request<{ items: NoteTreeItem[] }>(`${base(spaceId)}/tree`)
  return data.items
}

export function createPage(
  spaceId: string,
  input: { title?: string; parent_id?: string | null } = {}
): Promise<WorkspacePage> {
  return request(`${base(spaceId)}/pages`, json('POST', input))
}

export function fetchPage(spaceId: string, noteId: string): Promise<WorkspacePage> {
  return request(`${base(spaceId)}/pages/${noteId}`)
}

export function patchPage(
  spaceId: string,
  noteId: string,
  patch: NotePatch
): Promise<WorkspacePage> {
  return request(`${base(spaceId)}/pages/${noteId}`, json('PATCH', patch))
}

export function trashPage(spaceId: string, noteId: string): Promise<void> {
  return request(`${base(spaceId)}/${noteId}/trash`, { method: 'POST' })
}

export function restorePage(spaceId: string, noteId: string): Promise<WorkspacePage> {
  return request(`${base(spaceId)}/${noteId}/restore`, { method: 'POST' })
}

export function duplicatePage(spaceId: string, noteId: string): Promise<WorkspacePage> {
  return request(`${base(spaceId)}/${noteId}/duplicate`, { method: 'POST' })
}

export async function fetchTrash(spaceId: string): Promise<NoteTrashItem[]> {
  const data = await request<{ items: NoteTrashItem[] }>(`${base(spaceId)}/trash`)
  return data.items
}

export function deleteForever(spaceId: string, noteId: string): Promise<void> {
  return request(`${base(spaceId)}/trash/${noteId}`, { method: 'DELETE' })
}

export async function searchNotes(
  spaceId: string,
  query: string,
  signal?: AbortSignal
): Promise<NoteSearchHit[]> {
  const q = encodeURIComponent(query.trim().slice(0, 100))
  const data = await request<{ items: NoteSearchHit[] }>(`${base(spaceId)}/search?q=${q}`, {
    signal,
  })
  return data.items
}

export function fetchLinks(spaceId: string, noteId: string): Promise<NoteLinks> {
  return request(`${base(spaceId)}/${noteId}/links`)
}

export function exportMarkdownUrl(spaceId: string, noteId: string): string {
  return `${base(spaceId)}/${noteId}/export`
}
