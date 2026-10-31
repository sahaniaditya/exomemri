import type { SlashItem } from './types'
import type { CalloutVariant } from '@/lib/notes/palette'

const CALLOUTS: { variant: CalloutVariant; emoji: string; title: string; description: string }[] = [
  { variant: 'info', emoji: '💡', title: 'Callout', description: 'Highlight a tip or note' },
  { variant: 'success', emoji: '✅', title: 'Success callout', description: 'Mark something that went well' },
  { variant: 'warning', emoji: '⚠️', title: 'Warning callout', description: 'Flag something to watch out for' },
  { variant: 'danger', emoji: '🚫', title: 'Danger callout', description: 'Call out a risk or a blocker' },
]

export const blockSlashItems: SlashItem[] = [
  {
    id: 'taskList',
    title: 'Task list',
    description: 'Track to-dos with checkboxes',
    keywords: ['todo', 'task', 'checkbox', 'check', 'list'],
    group: 'Blocks',
    icon: '☑',
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    id: 'table',
    title: 'Table',
    description: 'Insert a 3 by 3 table',
    keywords: ['table', 'grid', 'rows', 'columns'],
    group: 'Blocks',
    icon: '▦',
    run: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  ...CALLOUTS.map(
    ({ variant, emoji, title, description }): SlashItem => ({
      id: variant === 'info' ? 'callout' : `callout-${variant}`,
      title,
      description,
      keywords: ['callout', 'note', 'aside', 'box', variant],
      group: 'Blocks',
      icon: emoji,
      run: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).insertCallout({ variant, emoji }).run(),
    }),
  ),
  {
    id: 'toggle',
    title: 'Toggle',
    description: 'Collapsible section',
    keywords: ['toggle', 'collapse', 'fold', 'accordion', 'details'],
    group: 'Blocks',
    icon: '▸',
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertToggle().run(),
  },
]
