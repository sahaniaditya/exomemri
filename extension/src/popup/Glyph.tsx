import { color, font } from "./theme"

/**
 * The exomemri mark — copied from the web app's shared brand component
 * (frontend/src/components/brand/Mark.tsx) so the extension carries the exact
 * same logo. The same paths are rasterized into public/icon.png for the
 * toolbar icon.
 *
 * Detail is shed below 40px and again below 20px, and the stroke gets
 * relatively heavier as the mark shrinks, so the ring keeps its presence in
 * the toolbar instead of thinning away.
 */
export function Glyph({ size = 24, surface = color.paper }: { size?: number; surface?: string }) {
  const full = size >= 40
  const medium = size >= 20
  const ringPx = size >= 40 ? size * 0.021 : size >= 20 ? size * 0.05 : 1.2
  const ring = (ringPx * 48) / size
  const hairline = ring * (full ? 0.65 : 0.75)
  const coreR = full ? 3.5 : medium ? 4.2 : 5

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="21.2" stroke={color.green} strokeWidth={ring} />
      {medium && (
        <g stroke={color.green} strokeWidth={hairline} opacity=".5">
          <ellipse cx="24" cy="24" rx="9.4" ry="21.2" />
          <path d="M2.8 24h42.4" />
          {full && (
            <>
              <path d="M6.4 13.2c10.4 4.6 24.8 4.6 35.2 0" />
              <path d="M6.4 34.8c10.4-4.6 24.8-4.6 35.2 0" />
            </>
          )}
        </g>
      )}
      <circle cx="32.6" cy="15.4" r={coreR * 1.7} fill={surface} />
      <circle cx="32.6" cy="15.4" r={coreR} fill={color.clay} />
    </svg>
  )
}

/** The contour-line wash used behind the web app's auth screens. */
export function ContourBg({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", ...style }}
    >
      <g fill="none" stroke={color.green} strokeWidth="1" opacity=".10">
        <path d="M-50 520C220 400 360 560 640 460 940 352 1120 550 1520 440" />
        <path d="M-50 580C220 460 360 620 640 520 940 412 1120 610 1520 500" />
        <path d="M-50 460C240 350 380 510 660 410 960 302 1120 490 1520 380" />
        <path d="M-50 640C200 530 360 690 640 590 940 482 1120 670 1520 560" />
        <path d="M-50 400C260 300 400 450 680 360 980 260 1120 430 1520 330" />
      </g>
    </svg>
  )
}

/** Wordmark: two-tone Newsreader — "exo" in forest, "memri" in ink. */
export function Wordmark({ size = 16 }: { size?: number }) {
  return (
    <span
      style={{
        fontFamily: font.serif,
        fontSize: size,
        fontWeight: 400,
        letterSpacing: "-0.022em",
        lineHeight: 1,
        color: color.ink,
      }}
    >
      <span style={{ color: color.green }}>exo</span>
      memri
    </span>
  )
}
