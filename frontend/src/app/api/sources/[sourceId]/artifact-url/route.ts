import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

/** Proxy signed GET URLs for private note images / other artifacts. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params
  const token = (await cookies()).get('atlas_token')?.value ?? ''
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const key = req.nextUrl.searchParams.get('key') ?? 'raw/meta.json'
  const res = await apiFetch(
    `/v1/sources/${sourceId}/artifact-url?key=${encodeURIComponent(key)}`,
    {},
    token
  )
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
