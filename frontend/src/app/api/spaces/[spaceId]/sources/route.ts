import { proxy, type SpaceParams } from '@/lib/notes/bff'

/** Captures in a space, for the note editor's capture / @-mention pickers. */
export async function GET(_req: Request, { params }: SpaceParams) {
  const { spaceId } = await params
  return proxy(`/v1/spaces/${spaceId}/sources?limit=100`, 'GET')
}
