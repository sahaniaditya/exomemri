import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

/** Proxy signed GET URLs for private space note images. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await params
  const token = (await cookies()).get('atlas_token')?.value ?? ''
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const key = req.nextUrl.searchParams.get('key')
  if (!key) {
    return NextResponse.json({ detail: 'Missing key' }, { status: 400 })
  }
  const res = await apiFetch(
    `/v1/spaces/${spaceId}/note-artifact-url?key=${encodeURIComponent(key)}`,
    {},
    token
  )
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
