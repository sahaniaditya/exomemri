import { notesEndpoint, proxy, type SpaceParams } from '@/lib/notes/bff'

export async function GET(_req: Request, { params }: SpaceParams) {
  const { spaceId } = await params
  return proxy(notesEndpoint(spaceId, '/trash'), 'GET')
}
