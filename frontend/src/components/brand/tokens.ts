/**
 * Brand colours for the logo, and the four surfaces it is allowed to sit on.
 * Kept next to the mark rather than in a page stylesheet so every surface
 * (marketing, auth, dashboard, exports) renders the identical identity.
 */
export const BRAND_COLORS = {
  ink: '#1b1a16',
  paper: '#f4f1e9',
  forest: '#2c5d4f',
  clay: '#b5623c',
  /** Clay lifted for dark grounds — #b5623c loses too much contrast on forest/ink. */
  clayLight: '#d98a5f',
  /** Forest lifted for dark grounds, used by the reversed wordmark. */
  forestLight: '#a8c8b8',
  reversedInk: '#eff3ef',
} as const

/**
 * `forest` is the primary lockup. `reversed` is for forest/ink grounds.
 * `ink` and `paper` are the single-colour versions — print, stamps, and
 * anywhere colour is not available.
 */
export type BrandTone = 'forest' | 'reversed' | 'ink' | 'paper'

/** Stroke (ring + meridians) and core-dot colour for each tone. */
export const TONE_COLORS: Record<BrandTone, { stroke: string; core: string }> = {
  forest: { stroke: BRAND_COLORS.forest, core: BRAND_COLORS.clay },
  reversed: { stroke: BRAND_COLORS.reversedInk, core: BRAND_COLORS.clayLight },
  ink: { stroke: BRAND_COLORS.ink, core: BRAND_COLORS.ink },
  paper: { stroke: BRAND_COLORS.paper, core: BRAND_COLORS.paper },
}

/** Default ground each tone is drawn against — what the core dot knocks out of. */
export const TONE_SURFACES: Record<BrandTone, string> = {
  forest: BRAND_COLORS.paper,
  reversed: BRAND_COLORS.forest,
  ink: BRAND_COLORS.paper,
  paper: BRAND_COLORS.ink,
}
