import { notesEndpoint, proxy, type NoteParams } from '@/lib/notes/bff'

export async function POST(_req: Request, { params }: NoteParams) {
  const { spaceId, noteId } = await params
  return proxy(notesEndpoint(spaceId, `/${noteId}/trash`), 'POST')
}
