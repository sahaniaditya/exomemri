'use client'

import { useTheme } from 'next-themes'

import type { BrandTone } from './tokens'
import { useIsMounted } from '@/lib/use-is-mounted'

/**
 * Resolves the lockup tone for the active color scheme. Explicit tones win;
 * `auto` (the default) picks `forest` on light paper and `dusk` on dark.
 */
export function useBrandTone(tone: BrandTone | 'auto' = 'auto'): BrandTone {
  const { resolvedTheme } = useTheme()
  const mounted = useIsMounted()

  if (tone !== 'auto') return tone
  // SSR + first paint: forest avoids a flash of the dusk mark on light pages.
  if (!mounted) return 'forest'
  return resolvedTheme === 'dark' ? 'dusk' : 'forest'
}
