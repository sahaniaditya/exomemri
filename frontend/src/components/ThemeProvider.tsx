'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

/**
 * next-themes injects an inline <script> to prevent theme FOUC. React 19
 * flags script tags rendered inside components during client render. On the
 * client we retag it as application/json so React skips that check; during
 * SSR the script stays executable so the theme still applies before paint.
 * @see https://github.com/pacocoursey/next-themes/issues/387
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const scriptProps =
    typeof window === 'undefined'
      ? undefined
      : ({ type: 'application/json' } as const)

  return (
    <NextThemesProvider {...props} scriptProps={scriptProps}>
      {children}
    </NextThemesProvider>
  )
}
