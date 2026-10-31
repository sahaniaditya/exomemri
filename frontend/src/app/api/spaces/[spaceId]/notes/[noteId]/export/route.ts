import { notesEndpoint, proxy, type NoteParams } from '@/lib/notes/bff'

/** Markdown download; the backend's content-type and filename pass through. */
export async function GET(_req: Request, { params }: NoteParams) {
  const { spaceId, noteId } = await params
  return proxy(notesEndpoint(spaceId, `/${noteId}/export.md`), 'GET')
}
