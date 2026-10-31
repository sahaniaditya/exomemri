'use client'

import type { PaletteColor } from '@/lib/notes/palette'
import styles from './note-blocks.module.css'

interface ColorPaletteProps {
  label: string
  colors: readonly PaletteColor[]
  /** Currently applied colour value, if any. */
  active: string | null
  /** 'text' swatches show an "A" in the colour; 'fill' swatches are filled. */
  variant: 'text' | 'fill'
  onPick: (value: string) => void
  onClear: () => void
}

export default function ColorPalette({
  label,
  colors,
  active,
  variant,
  onPick,
  onClear,
}: ColorPaletteProps) {
  return (
    <div className={styles.popover} role="group" aria-label={label}>
      <div className={styles.swatches}>
        {colors.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`${styles.swatch} ${active === c.value ? styles.swatchOn : ''}`}
            style={variant === 'fill' ? { background: c.value } : { color: c.value }}
            aria-label={`${label}: ${c.label}`}
            aria-pressed={active === c.value}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(c.value)}
          >
            {variant === 'text' ? 'A' : ''}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.item}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClear}
      >
        Clear {label.toLowerCase()}
      </button>
    </div>
  )
}
