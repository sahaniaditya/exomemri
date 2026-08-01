/**
 * Design tokens mirrored from the web app (frontend/src/app/login/page.tsx and
 * the landing page). Keep these in sync with the frontend — the popup is meant
 * to read as the same product, not a lookalike.
 */
export const color = {
  /** Page canvas — warm paper. */
  paper: "#F4F1E9",
  /** Raised surfaces (cards, popovers). */
  surface: "#FBFAF6",
  /** Primary brand green. */
  green: "#2C5D4F",
  /** Hover/pressed green. */
  greenDeep: "#234C40",
  /** Disabled / muted green. */
  greenSoft: "#7FA88C",
  /** Terracotta accent — the dot in the glyph, and error text. */
  clay: "#B5623C",
  /** Primary ink. */
  ink: "#1B1A16",
  /** Body copy. */
  inkMuted: "#5B5A52",
  /** Labels, mono eyebrows. */
  sage: "#7C8A7E",
  /** Faintest text (footers, hints). */
  sageLight: "#9AA69C",
  /** Hairlines. */
  line: "rgba(27,26,22,.13)",
  lineStrong: "rgba(27,26,22,.18)",
} as const

export const font = {
  serif: "'Newsreader', Georgia, 'Times New Roman', serif",
  sans: "'Instrument Sans', system-ui, -apple-system, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const
