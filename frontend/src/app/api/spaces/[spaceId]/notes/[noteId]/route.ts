import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string; noteId: string }> }
) {
  const { spaceId, noteId } = await params
  const token = (await cookies()).get('atlas_token')?.value ?? ''
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const res = await apiFetch(
    `/v1/spaces/${spaceId}/notes/${noteId}`,
    { method: 'PUT', body: JSON.stringify(body) },
    token
  )
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ spaceId: string; noteId: string }> }
) {
  const { spaceId, noteId } = await params
  const token = (await cookies()).get('atlas_token')?.value ?? ''
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const res = await apiFetch(
    `/v1/spaces/${spaceId}/notes/${noteId}`,
    { method: 'DELETE' },
    token
  )
  if (res.status === 204) return new NextResponse(null, { status: 204 })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
