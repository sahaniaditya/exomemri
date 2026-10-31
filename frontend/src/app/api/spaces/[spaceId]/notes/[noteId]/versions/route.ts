import { NextRequest } from 'next/server'
import { forwardToBackend } from '@/lib/notes/bff'

type Params = { params: Promise<{ spaceId: string; noteId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { spaceId, noteId } = await params
  return forwardToBackend(`/v1/spaces/${spaceId}/notes/${noteId}/versions`)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { spaceId, noteId } = await params
  const body = await req.text()
  return forwardToBackend(`/v1/spaces/${spaceId}/notes/${noteId}/versions`, {
    method: 'POST',
    body: body || undefined,
  })
}
