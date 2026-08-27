import { TONE_COLORS, TONE_SURFACES, type BrandTone } from './tokens'
import styles from './brand.module.css'

/**
 * The exomemri mark — a meridian globe with the clay core sitting off-centre
 * on a latitude (centred, it reads as an eye rather than a located memory).
 *
 * Drawn from one 48-unit grid at every size, with two optical corrections
 * that a plain `transform: scale()` could not make:
 *
 *  - detail is shed as the mark gets smaller, so the meridians never collapse
 *    into a smudge in a 16px tab strip;
 *  - the stroke gets relatively heavier as the mark gets smaller, so the ring
 *    keeps roughly a 1.2px presence instead of disappearing.
 *
 * Standalone icon: use it anywhere a glyph is needed. Paired with the
 * wordmark, use `<Lockup />` so the gap and sizing stay consistent.
 */
export function Mark({
  size = 24,
  tone = 'forest',
  surface,
  title,
  className,
}: {
  size?: number
  tone?: BrandTone
  /**
   * Colour of the ground behind the mark; the core dot knocks a halo out of
   * the meridians in this colour. Defaults to the tone's usual ground — pass
   * it explicitly on a card (#fbfaf6) or any other non-standard surface.
   */
  surface?: string
  /** Accessible name. Omitted (the default) renders the mark as decorative. */
  title?: string
  className?: string
}) {
  const { stroke, core } = TONE_COLORS[tone]
  const ground = surface ?? TONE_SURFACES[tone]

  // Detail level and weights, keyed off the rendered size.
  const full = size >= 40
  const medium = size >= 20
  const ringPx = size >= 40 ? size * 0.021 : size >= 20 ? size * 0.05 : 1.2
  const ring = (ringPx * 48) / size
  const hairline = ring * (full ? 0.65 : 0.75)
  const coreR = full ? 3.5 : medium ? 4.2 : 5

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      className={className ? `${styles.mark} ${className}` : styles.mark}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="24" cy="24" r="21.2" stroke={stroke} strokeWidth={ring} />
      {medium ? (
        <g stroke={stroke} strokeWidth={hairline} opacity={tone === 'reversed' || tone === 'dusk' ? 0.55 : 0.5}>
          <ellipse cx="24" cy="24" rx="9.4" ry="21.2" />
          <path d="M2.8 24h42.4" />
          {full ? (
            <>
              <path d="M6.4 13.2c10.4 4.6 24.8 4.6 35.2 0" />
              <path d="M6.4 34.8c10.4-4.6 24.8-4.6 35.2 0" />
            </>
          ) : null}
        </g>
      ) : null}
      <circle cx="32.6" cy="15.4" r={coreR * 1.7} fill={ground} />
      <circle cx="32.6" cy="15.4" r={coreR} fill={core} />
    </svg>
  )
}
