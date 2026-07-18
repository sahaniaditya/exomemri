/**
 * SHA-256 hex digest via the Web Crypto API.
 *
 * Mirrors the backend's `compute_content_hash` (app/services/capture_service.py):
 * hash the content, or the URL when content is absent. Available in both the
 * MV3 service worker and content scripts.
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** Content hash: content when present, else the URL. */
export function contentHash(content: string | null, url: string | null): Promise<string> {
  return sha256Hex(content ? content : (url ?? ""))
}
