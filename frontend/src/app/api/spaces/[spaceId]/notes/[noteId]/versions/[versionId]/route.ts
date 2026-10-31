import { NextRequest } from 'next/server'
import { forwardToBackend } from '@/lib/notes/bff'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ spaceId: string; noteId: string; versionId: string }> }
) {
  const { spaceId, noteId, versionId } = await params
  return forwardToBackend(`/v1/spaces/${spaceId}/notes/${noteId}/versions/${versionId}`)
}
