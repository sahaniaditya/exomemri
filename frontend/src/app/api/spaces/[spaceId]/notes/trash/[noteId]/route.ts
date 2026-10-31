import { notesEndpoint, proxy, type NoteParams } from '@/lib/notes/bff'

/** Permanently delete a page that is already in the trash. */
export async function DELETE(_req: Request, { params }: NoteParams) {
  const { spaceId, noteId } = await params
  return proxy(notesEndpoint(spaceId, `/trash/${noteId}`), 'DELETE')
}
