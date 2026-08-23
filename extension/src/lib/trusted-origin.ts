/**
 * Origins allowed to push a session into the extension via the atlas-bridge
 * content script. Keep `WEB_APP_MATCH_PATTERNS` in sync with the background
 * allowlist (`isTrustedWebOrigin`) — they are one contract.
 *
 * Chrome match patterns do NOT allow a port wildcard (`localhost:*`).
 * `http://localhost/*` already matches every localhost port.
 * See https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
 */

/** Manifest `matches` / `host_permissions` / `tabs.query` patterns. */
export const WEB_APP_MATCH_PATTERNS = [
  "http://localhost/*",
  "http://localhost:3000/*",
  "http://localhost:3001/*",
  "http://127.0.0.1/*",
  "http://127.0.0.1:3000/*",
  "http://127.0.0.1:3001/*",
  "https://localhost/*",
  "https://127.0.0.1/*",
  "https://atlas-ai-puce-xi.vercel.app/*",
  "https://atlas.ai/*",
  "https://*.atlas.ai/*",
] as const

const TRUSTED_WEB_ORIGINS = new Set(["https://atlas-ai-puce-xi.vercel.app"])
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"])

/**
 * True when `raw` is an exomemri web-app origin that may relay `atlas.session`.
 * Accepts a full URL or a bare origin (`http://localhost:3001`).
 */
export function isTrustedWebOrigin(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }

  if (TRUSTED_WEB_ORIGINS.has(url.origin)) return true

  if (LOCAL_HOSTS.has(url.hostname) && (url.protocol === "http:" || url.protocol === "https:")) {
    return true
  }

  return url.hostname === "atlas.ai" || url.hostname.endsWith(".atlas.ai")
}

export function isTrustedSender(sender: {
  origin?: string
  url?: string
  tab?: { url?: string }
}): boolean {
  const candidates = [sender.origin, sender.url, sender.tab?.url]
  return candidates.some((raw) => typeof raw === "string" && isTrustedWebOrigin(raw))
}
