/**
 * Fixed 6-colour palettes for text colour and highlight. Values are CSS variables defined in
 * `components/notes/note-blocks.module.css` for both light and dark themes, so the stored colour
 * stays readable whichever theme the note is viewed in.
 */
export interface PaletteColor {
  id: string
  label: string
  value: string
}

const make = (prefix: string, ids: string[]): PaletteColor[] =>
  ids.map((id) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    value: `var(--note-${prefix}-${id})`,
  }))

const IDS = ['gray', 'red', 'orange', 'green', 'blue', 'purple']

export const NOTE_TEXT_COLORS: readonly PaletteColor[] = make('text', IDS)
export const NOTE_HIGHLIGHT_COLORS: readonly PaletteColor[] = make('hl', ['yellow', ...IDS.slice(1)])

export const CALLOUT_VARIANTS = ['info', 'success', 'warning', 'danger'] as const
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number]

export const CALLOUT_EMOJIS = ['💡', '📌', '✅', '⚠️', '🚫', '❓', '🔥', '📝', '⭐', '🧠', '🎯', '💬']

export const DEFAULT_CALLOUT_EMOJI = '💡'
