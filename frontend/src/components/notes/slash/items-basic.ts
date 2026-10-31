import type { SlashItem } from './types'

/** Dispatched on the editor DOM when the Image slash item asks for the file picker. */
export const NOTE_PICK_IMAGE_EVENT = 'note:pick-image'

export const basicSlashItems: SlashItem[] = [
  {
    id: 'text',
    title: 'Text',
    description: 'Plain paragraph',
    keywords: ['paragraph', 'plain', 'p'],
    group: 'Basic',
    icon: 'T',
    run: ({ editor }) => {
      editor.chain().focus().setParagraph().run()
    },
  },
  {
    id: 'heading-1',
    title: 'Heading 1',
    description: 'Big section heading',
    keywords: ['h1', 'title', 'header', '#'],
    group: 'Basic',
    icon: 'H1',
    run: ({ editor }) => {
      editor.chain().focus().setHeading({ level: 1 }).run()
    },
  },
  {
    id: 'heading-2',
    title: 'Heading 2',
    description: 'Medium section heading',
    keywords: ['h2', 'subtitle', 'header', '##'],
    group: 'Basic',
    icon: 'H2',
    run: ({ editor }) => {
      editor.chain().focus().setHeading({ level: 2 }).run()
    },
  },
  {
    id: 'heading-3',
    title: 'Heading 3',
    description: 'Small section heading',
    keywords: ['h3', 'header', '###'],
    group: 'Basic',
    icon: 'H3',
    run: ({ editor }) => {
      editor.chain().focus().setHeading({ level: 3 }).run()
    },
  },
  {
    id: 'bullet-list',
    title: 'Bullet list',
    description: 'Simple bulleted list',
    keywords: ['ul', 'unordered', 'list', '-'],
    group: 'Basic',
    icon: '•',
    run: ({ editor }) => {
      editor.chain().focus().toggleBulletList().run()
    },
  },
  {
    id: 'numbered-list',
    title: 'Numbered list',
    description: 'List with numbering',
    keywords: ['ol', 'ordered', 'list', '1.'],
    group: 'Basic',
    icon: '1.',
    run: ({ editor }) => {
      editor.chain().focus().toggleOrderedList().run()
    },
  },
  {
    id: 'quote',
    title: 'Quote',
    description: 'Capture a quotation',
    keywords: ['blockquote', 'cite', '>'],
    group: 'Basic',
    icon: '"',
    run: ({ editor }) => {
      editor.chain().focus().toggleBlockquote().run()
    },
  },
  {
    id: 'divider',
    title: 'Divider',
    description: 'Visually separate sections',
    keywords: ['hr', 'rule', 'line', 'separator', '---'],
    group: 'Basic',
    icon: '—',
    run: ({ editor }) => {
      editor.chain().focus().setHorizontalRule().run()
    },
  },
  {
    id: 'code-block',
    title: 'Code block',
    description: 'Code snippet with copy',
    keywords: ['code', 'snippet', 'pre', '```'],
    group: 'Basic',
    icon: '</>',
    run: ({ editor }) => {
      editor.chain().focus().setCodeBlock().run()
    },
  },
  {
    id: 'image',
    title: 'Image',
    description: 'Upload an image (max 5 MB)',
    keywords: ['picture', 'photo', 'upload', 'img'],
    group: 'Media',
    icon: '▣',
    run: ({ editor }) => {
      editor.view.dom.dispatchEvent(new CustomEvent(NOTE_PICK_IMAGE_EVENT, { bubbles: true }))
    },
  },
]
