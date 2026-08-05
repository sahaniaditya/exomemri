/**
 * Canonical YouTube URL handling.
 *
 * Pure, no DOM. Two jobs:
 *  - decide whether a URL is a *video* (as opposed to a feed/channel/search
 *    page), which is what routes a capture to the YouTube extractor;
 *  - collapse every URL variant of one video onto a single canonical form, so
 *    `?t=42s`, `youtu.be/…` and `m.youtube.com/…` stop minting separate rows.
 *    The artifact JSON is the backend's dedupe basis, and the URL is inside it.
 */

/** YouTube ids are 11 chars today; kept loose but bounded. */
const VIDEO_ID = /^[\w-]{6,32}$/

/** Path prefixes that carry the video id as the next path segment. */
const PATH_PREFIXES = ["shorts", "live", "embed", "v"]

function isYouTubeHost(host: string): boolean {
  return host === "youtube.com" || host.endsWith(".youtube.com")
}

function fromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter((p) => p.length > 0)
  const [head, next] = parts
  if (!head || !next) return null
  return PATH_PREFIXES.includes(head) ? next : null
}

/**
 * The video id for a watch/shorts/live/embed URL, else null.
 *
 * Returns null for the homepage, feeds, channels, playlists and search — those
 * are pages, not videos, and must not be routed to the video extractor.
 */
export function videoIdFromUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const host = parsed.hostname.toLowerCase()
  let id: string | null = null

  if (host === "youtu.be" || host.endsWith(".youtu.be")) {
    id = parsed.pathname.split("/").filter((p) => p.length > 0)[0] ?? null
  } else if (isYouTubeHost(host)) {
    id = parsed.searchParams.get("v") ?? fromPath(parsed.pathname)
  }

  return id && VIDEO_ID.test(id) ? id : null
}

/** The one URL form every variant of a video collapses to. */
export function canonicalWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}
