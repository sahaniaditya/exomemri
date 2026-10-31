/**
 * Pure, immutable operations on top-level blocks of a TipTap/ProseMirror JSON document.
 * No editor, no DOM: everything here is unit-testable on plain objects.
 */
import type { JSONContent } from '@tiptap/core'

export type TurnIntoTarget =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'blockquote'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'callout'
  | 'toggle'
  | 'codeBlock'

export const TURN_INTO_TARGETS: readonly TurnIntoTarget[] = [
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'blockquote',
  'bulletList',
  'orderedList',
  'taskList',
  'callout',
  'toggle',
  'codeBlock',
]

const TEXTBLOCKS = new Set(['paragraph', 'heading', 'codeBlock'])
const LISTS = new Set(['bulletList', 'orderedList', 'taskList'])

type ListKind = 'bulletList' | 'orderedList' | 'taskList'

const clone = <T,>(value: T): T => structuredClone(value)

const validIndex = (blocks: unknown[], i: number) =>
  Number.isInteger(i) && i >= 0 && i < blocks.length

/** Move the block at `fromIndex` so it ends up at `toIndex`. Out-of-range or no-op returns the same doc. */
export function moveBlock(doc: JSONContent, fromIndex: number, toIndex: number): JSONContent {
  const blocks = doc.content ?? []
  if (!validIndex(blocks, fromIndex) || !validIndex(blocks, toIndex) || fromIndex === toIndex) {
    return doc
  }
  const next = blocks.map(clone)
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return { ...doc, content: next }
}

/** Insert a deep copy of the block at `index` right after it. Out-of-range returns the same doc. */
export function duplicateBlock(doc: JSONContent, index: number): JSONContent {
  const blocks = doc.content ?? []
  if (!validIndex(blocks, index)) return doc
  const next = blocks.map(clone)
  next.splice(index + 1, 0, clone(blocks[index]))
  return { ...doc, content: next }
}

/** Remove the block at `index`; the document always keeps at least one (empty) paragraph. */
export function deleteBlock(doc: JSONContent, index: number): JSONContent {
  const blocks = doc.content ?? []
  if (!validIndex(blocks, index)) return doc
  const next = blocks.filter((_, i) => i !== index).map(clone)
  return { ...doc, content: next.length ? next : [{ type: 'paragraph' }] }
}

function plainTextOf(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? ''
  const parts = (node.content ?? []).map(plainTextOf)
  const isTextblock = TEXTBLOCKS.has(node.type ?? '') || node.type === 'toggleSummary'
  return parts.join(isTextblock ? '' : '\n')
}

function plainInline(node: JSONContent): JSONContent[] {
  const text = plainTextOf(node)
  return text ? [{ type: 'text', text }] : []
}

/** Inline content of a node, keeping marks for text blocks and flattening anything else. */
function inlineOf(node: JSONContent): JSONContent[] {
  return TEXTBLOCKS.has(node.type ?? '') && node.content ? clone(node.content) : plainInline(node)
}

const paragraphOf = (inline: JSONContent[]): JSONContent =>
  inline.length ? { type: 'paragraph', content: inline } : { type: 'paragraph' }

const asParagraph = (block: JSONContent): JSONContent =>
  block.type === 'paragraph' ? block : paragraphOf(inlineOf(block))

/**
 * Flatten a block into plain content blocks, or null when it carries no convertible text
 * (image, table, horizontal rule ...). Containers keep their children; lists flatten to paragraphs.
 */
function asBlocks(node: JSONContent): JSONContent[] | null {
  switch (node.type) {
    case 'paragraph':
    case 'heading':
    case 'codeBlock':
      return [paragraphOf(inlineOf(node))]
    case 'blockquote':
    case 'callout':
      return (node.content ?? []).map(clone)
    case 'toggle': {
      const [summary, ...body] = node.content ?? []
      return [paragraphOf(summary ? inlineOf(summary) : []), ...body.map(clone)]
    }
    case 'bulletList':
    case 'orderedList':
    case 'taskList': {
      const out: JSONContent[] = []
      const walk = (item: JSONContent) => {
        for (const child of item.content ?? []) {
          if (LISTS.has(child.type ?? '')) (child.content ?? []).forEach(walk)
          else out.push(...(asBlocks(child) ?? []))
        }
      }
      ;(node.content ?? []).forEach(walk)
      return out.length ? out : [{ type: 'paragraph' }]
    }
    default:
      return null
  }
}

function buildList(kind: ListKind, source: JSONContent, blocks: JSONContent[]): JSONContent[] {
  const itemType = kind === 'taskList' ? 'taskItem' : 'listItem'
  const itemAttrs = kind === 'taskList' ? { attrs: { checked: false } } : {}
  // Between list kinds keep the item structure (and nesting) intact.
  if (LISTS.has(source.type ?? '')) {
    const convertItem = (item: JSONContent): JSONContent => ({
      type: itemType,
      ...itemAttrs,
      content: (item.content ?? []).map((child) =>
        LISTS.has(child.type ?? '')
          ? { type: kind, content: (child.content ?? []).map(convertItem) }
          : clone(child),
      ),
    })
    return [{ type: kind, content: (source.content ?? []).map(convertItem) }]
  }
  // A list item must start with a paragraph; every other block becomes its own item.
  const items = blocks.map((block) => ({
    type: itemType,
    ...itemAttrs,
    content: [asParagraph(block)],
  }))
  return [{ type: kind, content: items }]
}

/**
 * Convert a block to another block type, returning the replacement blocks (usually one, but
 * converting a list to paragraphs yields one paragraph per item). Blocks without convertible
 * text (image, table, rule ...) and conversions to the block's own type are returned unchanged.
 */
export function turnInto(block: JSONContent, target: TurnIntoTarget): JSONContent[] {
  const same =
    block.type === 'heading' ? target === `heading${block.attrs?.level}` : target === block.type
  const blocks = asBlocks(block)
  if (same || !blocks) return [clone(block)]

  switch (target) {
    case 'paragraph':
      return blocks.map(asParagraph)
    case 'heading1':
    case 'heading2':
    case 'heading3': {
      const [first, ...rest] = blocks.map(asParagraph)
      const level = Number(target.slice(-1))
      return [
        { type: 'heading', attrs: { level }, ...(first.content ? { content: first.content } : {}) },
        ...rest,
      ]
    }
    case 'blockquote':
      return [{ type: 'blockquote', content: blocks }]
    case 'callout':
      return [{ type: 'callout', attrs: { emoji: '💡', variant: 'info' }, content: blocks }]
    case 'toggle': {
      const [first, ...rest] = blocks
      const summary = first ? inlineOf(first) : []
      return [
        {
          type: 'toggle',
          attrs: { open: true },
          content: [
            { type: 'toggleSummary', ...(summary.length ? { content: summary } : {}) },
            ...rest,
          ],
        },
      ]
    }
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return buildList(target, block, blocks)
    case 'codeBlock': {
      const text = blocks.map(plainTextOf).join('\n')
      return [{ type: 'codeBlock', ...(text ? { content: [{ type: 'text', text }] } : {}) }]
    }
  }
}

export interface BlockRect {
  top: number
  bottom: number
}

/**
 * Insertion slot (0..n) for a drag at vertical position `y`: before the first block whose
 * midpoint is below `y`, or n (the end) when `y` is past every midpoint.
 */
export function dropSlotForY(rects: BlockRect[], y: number): number {
  const i = rects.findIndex((r) => y < (r.top + r.bottom) / 2)
  return i === -1 ? rects.length : i
}

/** Convert an insertion slot into the `toIndex` for `moveBlock` (removing the block shifts later slots). */
export function slotToTargetIndex(fromIndex: number, slot: number): number {
  return slot > fromIndex ? slot - 1 : slot
}
