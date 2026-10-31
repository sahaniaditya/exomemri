/** Heading outline of a TipTap JSON document, with ProseMirror positions. */

export interface OutlineEntry {
  level: number
  text: string
  /** Position just before the heading node (what `view.nodeDOM` expects). */
  pos: number
}

interface JsonNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: JsonNode[]
}

const LEAF_TYPES = new Set([
  'image',
  'horizontalRule',
  'hardBreak',
  'captureEmbed',
  'noteMention',
  'sourceMention',
])

function nodeSize(node: JsonNode): number {
  if (node.type === 'text') return node.text?.length ?? 0
  if (node.type && LEAF_TYPES.has(node.type)) return 1
  return 2 + (node.content ?? []).reduce((sum, child) => sum + nodeSize(child), 0)
}

function plainText(node: JsonNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return ' '
  if (node.type === 'noteMention' || node.type === 'sourceMention') {
    return String(node.attrs?.title ?? '')
  }
  return (node.content ?? []).map(plainText).join('')
}

function walk(children: JsonNode[], start: number, out: OutlineEntry[]): void {
  let pos = start
  for (const node of children) {
    if (node.type === 'heading') {
      const raw = Number(node.attrs?.level)
      const level = Number.isInteger(raw) && raw >= 1 && raw <= 6 ? raw : 1
      const text = plainText(node).trim()
      if (text) out.push({ level, text, pos })
    } else if (node.content?.length && node.type !== 'codeBlock') {
      walk(node.content, pos + 1, out)
    }
    pos += nodeSize(node)
  }
}

/** Headings in document order. Empty headings are skipped. Never throws. */
export function extractOutline(doc: unknown): OutlineEntry[] {
  const out: OutlineEntry[] = []
  try {
    const root = doc as JsonNode | null
    if (root && Array.isArray(root.content)) walk(root.content, 0, out)
  } catch {
    return []
  }
  return out
}
