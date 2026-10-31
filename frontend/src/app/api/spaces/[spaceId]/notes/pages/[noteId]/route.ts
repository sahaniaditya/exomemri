import { notesEndpoint, proxy, readJson, type NoteParams } from '@/lib/notes/bff'

// GET/PATCH of a single workspace page live under `pages/` because the
// existing `notes/[noteId]/route.ts` (PUT/DELETE) belongs to the editor phase.

export async function GET(_req: Request, { params }: NoteParams) {
  const { spaceId, noteId } = await params
  return proxy(notesEndpoint(spaceId, `/${noteId}`), 'GET')
}

export async function PATCH(req: Request, { params }: NoteParams) {
  const { spaceId, noteId } = await params
  const parsed = await readJson(req)
  if (!parsed.ok) return parsed.response
  return proxy(notesEndpoint(spaceId, `/${noteId}`), 'PATCH', parsed.body)
}
