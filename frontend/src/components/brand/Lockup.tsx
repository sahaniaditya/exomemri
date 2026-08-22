import { Mark } from './Mark'
import { Wordmark } from './Wordmark'
import type { BrandTone } from './tokens'
import styles from './brand.module.css'

/**
 * The primary lockup: mark + wordmark, set at matching sizes with the gap
 * held at 0.4x the mark so the pairing stays optically identical from a
 * 22px nav to a 64px splash. Use this instead of placing the two by hand.
 */
export function Lockup({
  size = 24,
  tone = 'forest',
  surface,
  className,
}: {
  /** Mark size in px; the wordmark is set to match. */
  size?: number
  tone?: BrandTone
  /** Ground the lockup sits on — see `Mark`'s `surface`. */
  surface?: string
  className?: string
}) {
  return (
    <span
      className={className ? `${styles.lockup} ${className}` : styles.lockup}
      style={{ gap: Math.round(size * 0.4) }}
    >
      <Mark size={size} tone={tone} surface={surface} title="exomemri" />
      <Wordmark size={size} tone={tone} />
    </span>
  )
}
