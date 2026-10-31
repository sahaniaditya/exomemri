import { notesEndpoint, proxy, type SpaceParams } from '@/lib/notes/bff'

export async function GET(req: Request, { params }: SpaceParams) {
  const { spaceId } = await params
  const q = new URL(req.url).searchParams.get('q') ?? ''
  return proxy(notesEndpoint(spaceId, `/search?q=${encodeURIComponent(q)}`), 'GET')
}
