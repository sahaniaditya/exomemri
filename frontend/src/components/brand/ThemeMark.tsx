'use client'

import { Mark } from './Mark'
import type { BrandTone } from './tokens'
import { useBrandTone } from './useBrandTone'

/**
 * Theme-aware mark — same as `<Mark />` but defaults to forest/dusk by
 * color scheme. Use when a standalone glyph should flip with dark mode.
 */
export function ThemeMark({
  size = 24,
  tone = 'auto',
  surface,
  title,
  className,
}: {
  size?: number
  tone?: BrandTone | 'auto'
  surface?: string
  title?: string
  className?: string
}) {
  const resolved = useBrandTone(tone)
  return (
    <Mark
      size={size}
      tone={resolved}
      surface={surface}
      title={title}
      className={className}
    />
  )
}
