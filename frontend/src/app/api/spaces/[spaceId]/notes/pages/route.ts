import { notesEndpoint, proxy, readJson, type SpaceParams } from '@/lib/notes/bff'

/** Create a page, optionally under a root page (`parent_id`). */
export async function POST(req: Request, { params }: SpaceParams) {
  const { spaceId } = await params
  const parsed = await readJson(req)
  if (!parsed.ok) return parsed.response
  return proxy(notesEndpoint(spaceId, '/pages'), 'POST', parsed.body)
}
