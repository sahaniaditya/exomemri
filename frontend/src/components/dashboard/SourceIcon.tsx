import type { SourceKind } from '@/lib/dashboard-data'

/**
 * One consistent line-icon language for source kinds, replacing the old mix
 * of unicode glyphs (▶ ◆ ✦ ✎) and an emoji (📰) that didn't share a visual
 * weight or style with the rest of the UI.
 */
const PATHS: Record<SourceKind, React.ReactNode> = {
  video: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M10.5 9.5l4.5 2.5-4.5 2.5z" fill="currentColor" stroke="none" />
    </>
  ),
  article: (
    <>
      <path d="M5 4h11a2 2 0 0 1 2 2v13a1 1 0 0 1-1.53.85L15 18.5l-1.47 1.35a1 1 0 0 1-1.36 0L10.7 18.5l-1.47 1.35a1 1 0 0 1-1.53-.85V6a2 2 0 0 1 2-2z" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.2h4.5" />
    </>
  ),
  pdf: (
    <>
      <path d="M6.5 2.5h8l4 4v14a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1z" />
      <path d="M14.5 2.5v4h4" />
    </>
  ),
  chat: (
    <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4.4 3.3A.6.6 0 0 1 3.6 20V6a1 1 0 0 1 .4-1z" />
  ),
  note: (
    <>
      <path d="M4 19.5V16l10.5-10.5a1.5 1.5 0 0 1 2 0l1.5 1.5a1.5 1.5 0 0 1 0 2L7.5 19.5H4z" />
      <path d="M12.5 7.5l3 3" />
    </>
  ),
}

export default function SourceIcon({
  kind,
  size = 14,
}: {
  kind: SourceKind
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[kind]}
    </svg>
  )
}
