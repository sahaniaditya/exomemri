/**
 * The Atlas mark — copied verbatim from the web app (frontend/src/app/page.tsx
 * and login/page.tsx) so the extension carries the exact same logo. The same
 * paths are rasterized into public/icon.png for the toolbar icon.
 */
import { color } from "./theme"

export function Glyph({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" stroke={color.green} />
      <path
        d="M16 1.5v29M1.5 16h29M6 6c6 5 14 5 20 0M6 26c6-5 14-5 20 0M4.2 10.5c7 3.5 16.6 3.5 23.6 0M4.2 21.5c7-3.5 16.6-3.5 23.6 0"
        stroke={color.green}
        strokeWidth="1"
        opacity=".55"
      />
      <circle cx="16" cy="16" r="2.4" fill={color.clay} />
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

/** Wordmark: "atlas" in ink, ".ai" in brand green — as in the web nav. */
export function Wordmark({ size = 16 }: { size?: number }) {
  return (
    <span
      style={{
        fontFamily: "'Newsreader', Georgia, serif",
        fontSize: size,
        fontWeight: 500,
        letterSpacing: "-0.03em",
        color: color.ink,
      }}
    >
      atlas<span style={{ color: color.green }}>.ai</span>
    </span>
  )
}
