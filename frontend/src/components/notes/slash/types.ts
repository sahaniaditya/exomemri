import type { Editor, Range } from '@tiptap/core'

export type SlashGroup = 'Basic' | 'Blocks' | 'Media' | 'Captures' | 'AI'

export interface SlashItem {
  id: string
  title: string
  description?: string
  keywords: string[]
  group: SlashGroup
  /** Short glyph shown in the menu, e.g. "H1", "☑", "▦". */
  icon: string
  run: (args: { editor: Editor; range: Range }) => void
}
