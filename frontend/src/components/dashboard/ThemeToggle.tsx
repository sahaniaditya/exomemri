'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import styles from './dashboard.module.css'

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Wait until mounted on client to prevent SSR hydration mismatches
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Render a placeholder (matching dimensions) to avoid layout shift
    return <button type="button" className={styles.themeToggle} aria-label="Toggle dark mode" />
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}