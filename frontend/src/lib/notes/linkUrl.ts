export type LinkResult =
  | { kind: 'remove' }
  | { kind: 'set'; href: string }
  | { kind: 'invalid'; reason: string }

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/**
 * Validate what the user typed in the link field. Empty input removes the link; only http(s) and
 * mailto targets are accepted. A bare host such as `example.com` is treated as https.
 */
export function parseLinkInput(raw: string): LinkResult {
  const value = raw.trim()
  if (!value) return { kind: 'remove' }
  // "name@host" without a scheme is an email address, "host.tld/path" a web address.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value)
  const candidate = hasScheme
    ? value
    : /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(value)
      ? `mailto:${value}`
      : `https://${value}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { kind: 'invalid', reason: 'Enter a valid link' }
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { kind: 'invalid', reason: 'Only http, https and mailto links are allowed' }
  }
  if (url.protocol !== 'mailto:' && !url.hostname.includes('.') && url.hostname !== 'localhost') {
    return { kind: 'invalid', reason: 'Enter a valid link' }
  }
  return { kind: 'set', href: candidate }
}
