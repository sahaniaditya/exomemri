/**
 * Upload an image to the space's note-image storage and return its key.
 * Same flow as in-note images: mint a signed URL through the BFF, PUT the
 * bytes straight to storage, keep the returned key.
 */
export const ALLOWED_COVER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
export const MAX_COVER_BYTES = 5 * 1024 * 1024

export class CoverUploadError extends Error {
  readonly kind: 'type' | 'size' | 'session' | 'failed'

  constructor(kind: CoverUploadError['kind'], message: string) {
    super(message)
    this.name = 'CoverUploadError'
    this.kind = kind
  }
}

interface MintedUpload {
  key: string
  upload_url: string
}

export async function uploadNoteImage(spaceId: string, file: File): Promise<string> {
  if (!ALLOWED_COVER_TYPES.has(file.type)) {
    throw new CoverUploadError('type', 'Only JPEG, PNG, WebP or GIF images are supported.')
  }
  if (file.size > MAX_COVER_BYTES) {
    throw new CoverUploadError('size', 'Image must be under 5 MB.')
  }
  const mint = await fetch(`/api/spaces/${spaceId}/note-images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_type: file.type, filename: file.name || 'cover' }),
  })
  if (mint.status === 401) {
    throw new CoverUploadError('session', 'Your session has expired. Please log in again.')
  }
  if (!mint.ok) throw new CoverUploadError('failed', 'Image upload failed. Try again.')
  const signed = (await mint.json()) as MintedUpload

  const put = await fetch(signed.upload_url, {
    method: 'PUT',
    headers: { 'x-upsert': 'true', 'content-type': file.type },
    body: file,
  })
  if (!put.ok) throw new CoverUploadError('failed', 'Image upload failed. Try again.')
  return signed.key
}

/** Short-lived signed GET URL for a stored note image, or null on failure. */
export async function resolveNoteImageUrl(spaceId: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/spaces/${spaceId}/note-artifact-url?key=${encodeURIComponent(key)}`
    )
    if (!res.ok) return null
    const data = (await res.json()) as { url?: string }
    return data.url ?? null
  } catch {
    return null
  }
}
