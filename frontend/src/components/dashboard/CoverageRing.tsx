'use client'

import { useEffect, useState } from 'react'

import styles from './dashboard.module.css'

const RADIUS = 22
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Coverage dial that sweeps from empty to `pct` once mounted. */
export default function CoverageRing({ pct }: { pct: number }) {
  const [filled, setFilled] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setFilled(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className={styles.ring}>
      <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
        <circle className={styles.rt} cx="26" cy="26" r={RADIUS} />
        <circle
          className={styles.rv}
          cx="26"
          cy="26"
          r={RADIUS}
          style={{
            strokeDasharray: CIRCUMFERENCE,
            strokeDashoffset: filled ? CIRCUMFERENCE * (1 - pct / 100) : CIRCUMFERENCE,
          }}
        />
      </svg>
      <div className={styles.pct}>{pct}%</div>
    </div>
  )
}
