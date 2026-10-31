import type { AnyExtension } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { NoteCodeBlock } from '@/components/dashboard/NoteCodeBlockView'
import type { NotesScope } from '@/lib/notes'
import { SlashExtension } from '../slash/slashExtension'
import { aiSlashItems } from '../slash/items-ai'
import { basicSlashItems } from '../slash/items-basic'
import { blockSlashItems } from '../slash/items-blocks'
import { captureSlashItems } from '../slash/items-capture'
import type { SlashItem } from '../slash/types'
import { blockExtensions } from './blocks'
import { captureExtensions } from './captureExtensions'
import { NoteImage } from './noteImage'

/** Every slash item the full-page editor offers, in menu order. */
export const allSlashItems: SlashItem[] = [
  ...basicSlashItems,
  ...blockSlashItems,
  ...captureSlashItems,
  ...aiSlashItems,
]

export type NoteExtension = AnyExtension

export interface BuildNoteExtensionsOptions {
  /** Slash items; defaults to every phase's items. */
  slashItems?: SlashItem[]
}

export function notePlaceholder(scope: NotesScope): string {
  return scope.kind === 'space'
    ? 'Jot what you want to remember about this space…'
    : 'Jot what you want to remember from this capture…'
}

/**
 * Extensions for the full-page note editor. Headings 1 to 3 are enabled (so the Markdown
 * shortcuts `#`, `##`, `###`, `-`, `1.`, `>`, `---` and ``` work); the code block, link,
 * image and placeholder match the legacy capture-notes editor so saved documents load
 * unchanged. Returns an array so later phases can append their own extensions.
 */
export function buildNoteExtensions(
  scope: NotesScope,
  options: BuildNoteExtensionsOptions = {}
): NoteExtension[] {
  return [
    // `link` is configured separately below; StarterKit's own copy is disabled to avoid a duplicate.
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, link: false }),
    NoteCodeBlock.configure({ enableTabIndentation: true }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    }),
    NoteImage.configure({ inline: false, allowBase64: false }),
    Placeholder.configure({ placeholder: notePlaceholder(scope) }),
    ...blockExtensions(),
    // Capture embeds and @ mentions need a space to list captures from.
    ...(scope.kind === 'space' ? captureExtensions({ spaceId: scope.spaceId }) : []),
    SlashExtension.configure({ items: options.slashItems ?? allSlashItems }),
  ]
}
