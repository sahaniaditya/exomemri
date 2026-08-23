import type { CSSProperties } from 'react'

import { BRAND_COLORS, type BrandTone } from './tokens'
import styles from './brand.module.css'

/**
 * Product wordmark — shared across marketing, auth, and dashboard so the
 * brand never drifts between surfaces.
 *
 * Newsreader 400 tracked in to -0.022em, split two-tone at the compound seam:
 * "exo" in forest, "memri" in ink. The site's own display serif doing
 * logotype work, rather than the UI sans it used to borrow.
 */
export function Wordmark({
  size,
  tone = 'forest',
  className,
}: {
  /** Font size in px. Omitted, it inherits from the parent. */
  size?: number
  tone?: BrandTone
  className?: string
}) {
  const { base, prefix } = WORDMARK_TONES[tone]

  return (
    <span
      className={className ? `${styles.wordmark} ${className}` : styles.wordmark}
      style={size ? { ...base, fontSize: size } : base}
    >
      <span style={prefix}>exo</span>
      memri
    </span>
  )
}

const WORDMARK_TONES: Record<BrandTone, { base: CSSProperties; prefix: CSSProperties }> = {
  forest: { base: { color: BRAND_COLORS.ink }, prefix: { color: BRAND_COLORS.forest } },
  reversed: { base: { color: BRAND_COLORS.paper }, prefix: { color: BRAND_COLORS.forestLight } },
  ink: { base: { color: BRAND_COLORS.ink }, prefix: { color: BRAND_COLORS.ink } },
  paper: { base: { color: BRAND_COLORS.paper }, prefix: { color: BRAND_COLORS.paper } },
}
