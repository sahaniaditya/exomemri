/**
 * Browser client for note version history. Calls the local BFF routes only.
 */

export type VersionReason = 'idle' | 'manual' | 'pre_restore'

export interface NoteVersionSummary {
  id: string
  title: string
  reason: VersionReason
  created_at: string
}

export interface NoteVersion extends NoteVersionSummary {
  content: Record<string, unknown>
}

export interface RestoredNote {
  id: string
  space_id: string
  title: string
  content: Record<string, unknown>
  sort_order: number
  updated_at: string | null
}

export class VersionRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export function versionsUrl(spaceId: string, noteId: string, suffix = ''): string {
  return `/api/spaces/${spaceId}/notes/${noteId}/versions${suffix}`
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new VersionRequestError('Network error', 0)
  }
  if (!res.ok) throw new VersionRequestError(`Request failed (${res.status})`, res.status)
  return (await res.json()) as T
}

export function createSnapshot(
  spaceId: string,
  noteId: string,
  reason: 'idle' | 'manual' = 'idle'
): Promise<NoteVersionSummary> {
  return request(versionsUrl(spaceId, noteId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
}

export async function listVersions(
  spaceId: string,
  noteId: string
): Promise<NoteVersionSummary[]> {
  const data = await request<{ items: NoteVersionSummary[] }>(versionsUrl(spaceId, noteId))
  return data.items
}

export function getVersion(
  spaceId: string,
  noteId: string,
  versionId: string
): Promise<NoteVersion> {
  return request(versionsUrl(spaceId, noteId, `/${versionId}`))
}

export function restoreVersion(
  spaceId: string,
  noteId: string,
  versionId: string
): Promise<RestoredNote> {
  return request(versionsUrl(spaceId, noteId, `/${versionId}/restore`), { method: 'POST' })
}

export const VERSION_REASON_LABEL: Record<VersionReason, string> = {
  idle: 'Auto-saved',
  manual: 'Saved manually',
  pre_restore: 'Before a restore',
}
