'use client'

import { Mark } from './Mark'
import { Wordmark } from './Wordmark'
import type { BrandTone } from './tokens'
import { useBrandTone } from './useBrandTone'
import styles from './brand.module.css'

/**
 * The primary lockup: mark + wordmark, set at matching sizes with the gap
 * held at 0.4x the mark so the pairing stays optically identical from a
 * 22px nav to a 64px splash. Use this instead of placing the two by hand.
 *
 * Default tone is `auto` — forest on light, dusk (mint + warm clay) on dark.
 */
export function Lockup({
  size = 24,
  tone = 'auto',
  surface,
  className,
}: {
  /** Mark size in px; the wordmark is set to match. */
  size?: number
  tone?: BrandTone | 'auto'
  /** Ground the lockup sits on — see `Mark`'s `surface`. */
  surface?: string
  className?: string
}) {
  const resolved = useBrandTone(tone)

  return (
    <span
      className={className ? `${styles.lockup} ${className}` : styles.lockup}
      style={{ gap: Math.round(size * 0.4) }}
    >
      <Mark size={size} tone={resolved} surface={surface} title="exomemri" />
      <Wordmark size={size} tone={resolved} />
    </span>
  )
}
