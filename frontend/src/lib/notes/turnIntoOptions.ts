import type { TurnIntoTarget } from './blockOps'

export interface TurnIntoOption {
  target: TurnIntoTarget
  label: string
  icon: string
}

/** Labels for the "Turn into" menus (selection menu and block menu). */
export const TURN_INTO_OPTIONS: readonly TurnIntoOption[] = [
  { target: 'paragraph', label: 'Text', icon: '¶' },
  { target: 'heading1', label: 'Heading 1', icon: 'H1' },
  { target: 'heading2', label: 'Heading 2', icon: 'H2' },
  { target: 'heading3', label: 'Heading 3', icon: 'H3' },
  { target: 'blockquote', label: 'Quote', icon: '❝' },
  { target: 'bulletList', label: 'Bulleted list', icon: '•' },
  { target: 'orderedList', label: 'Numbered list', icon: '1.' },
  { target: 'taskList', label: 'To-do list', icon: '☑' },
  { target: 'callout', label: 'Callout', icon: '💡' },
  { target: 'toggle', label: 'Toggle', icon: '▸' },
  { target: 'codeBlock', label: 'Code', icon: '</>' },
]
