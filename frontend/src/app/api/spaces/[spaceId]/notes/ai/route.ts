import { NextRequest } from 'next/server'
import { forwardToBackend } from '@/lib/notes/bff'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await params
  const body = await req.text()
  return forwardToBackend(`/v1/spaces/${spaceId}/notes/ai`, { method: 'POST', body })
}
