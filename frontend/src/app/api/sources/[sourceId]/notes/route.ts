import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params
  const token = (await cookies()).get('atlas_token')?.value ?? ''
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const res = await apiFetch(`/v1/sources/${sourceId}/notes`, {}, token)
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params
  const token = (await cookies()).get('atlas_token')?.value ?? ''
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const res = await apiFetch(
    `/v1/sources/${sourceId}/notes`,
    { method: 'POST', body: JSON.stringify(body) },
    token
  )
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
