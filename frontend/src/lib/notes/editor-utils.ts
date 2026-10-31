/**
 * Pure editor helpers shared by the legacy capture-notes editor (NotePageEditor)
 * and the full-page editor (NoteEditorCore). Moved verbatim — behaviour is identical.
 */
import { NodeSelection } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/react'
import { notesArtifactUrlPath, type NotesScope } from '@/lib/notes'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export const EMOJIS = [
  '✨', '💡', '🔥', '✅', '❓', '📌', '🧠', '📎', '🔗', '📝',
  '⭐', '🎯', '⚠️', '🚀', '💬', '📖',
]

export const EMOJI_PANEL_WIDTH = 280
export const EMOJI_PANEL_GAP = 6
export const EMOJI_PANEL_VIEWPORT_MARGIN = 8

export interface EmojiPanelPosition {
  top: number
  left: number
}

/** Anchors the emoji panel to its trigger button, clamped so it never overflows the viewport. */
export function computeEmojiPanelPosition(
  anchorRect: DOMRect,
  panelSize: { width: number; height: number }
): EmojiPanelPosition {
  const panelWidth = panelSize.width || EMOJI_PANEL_WIDTH
  const panelHeight = panelSize.height

  let left = anchorRect.left
  if (left + panelWidth > window.innerWidth - EMOJI_PANEL_VIEWPORT_MARGIN) {
    // Not enough room to the right — right-align the panel to the button instead.
    left = anchorRect.right - panelWidth
  }
  left = Math.max(
    EMOJI_PANEL_VIEWPORT_MARGIN,
    Math.min(left, window.innerWidth - panelWidth - EMOJI_PANEL_VIEWPORT_MARGIN)
  )

  let top = anchorRect.bottom + EMOJI_PANEL_GAP
  const fitsBelow = top + panelHeight <= window.innerHeight - EMOJI_PANEL_VIEWPORT_MARGIN
  if (!fitsBelow) {
    const above = anchorRect.top - EMOJI_PANEL_GAP - panelHeight
    if (above >= EMOJI_PANEL_VIEWPORT_MARGIN) {
      // Not enough room below — flip to open above the button instead.
      top = above
    }
  }
  top = Math.max(EMOJI_PANEL_VIEWPORT_MARGIN, top)

  return { top, left }
}

export async function resolveImageSrc(scope: NotesScope, key: string): Promise<string | null> {
  try {
    const res = await fetch(notesArtifactUrlPath(scope, key))
    if (!res.ok) return null
    const data = (await res.json()) as { url: string }
    return data.url
  } catch {
    return null
  }
}

export function isUploadableImage(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES
}

export function isProbablyUrl(text: string): boolean {
  return /^https?:\/\//i.test(text) && !/\s/.test(text)
}

export function isImageOnlyHtml(html: string): boolean {
  const leftover = html
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?(html|head|body|meta|link|span|div|br|p|a|fragment)[^>]*>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return leftover.length === 0
}

export function isImageOnlyClipboard(data: DataTransfer): boolean {
  const text = data.getData('text/plain').trim()
  if (text && !isProbablyUrl(text)) return false
  const html = data.getData('text/html')
  if (!html.trim()) return true
  return isImageOnlyHtml(html)
}

export function insertPastedCode(editor: Editor, text: string): boolean {
  const normalized = text.replace(/\r\n/g, '\n')
  if (!normalized) return false
  const { selection } = editor.state
  const insideCodeText =
    editor.isActive('codeBlock') && !(selection instanceof NodeSelection)
  if (insideCodeText) {
    const { from, to } = selection
    editor.view.dispatch(editor.state.tr.insertText(normalized, from, to))
    return true
  }
  return editor
    .chain()
    .focus()
    .insertContent({
      type: 'codeBlock',
      content: [{ type: 'text', text: normalized }],
    })
    .run()
}

export function collectClipboardImages(event: ClipboardEvent): File[] {
  const data = event.clipboardData
  if (!data) return []
  const files: File[] = []
  const seen = new Set<File>()
  for (const item of Array.from(data.items)) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file && !seen.has(file)) {
      seen.add(file)
      files.push(file)
    }
  }
  if (files.length) return files
  return Array.from(data.files).filter(file => file.type.startsWith('image/'))
}

export function imageFilename(file: File): string {
  const name = file.name.trim()
  if (name) return name
  const subtype = file.type.split('/')[1]?.toLowerCase() ?? 'png'
  const ext = subtype === 'jpeg' ? 'jpg' : subtype
  return `pasted-image.${ext}`
}

export function clampInsertPos(editor: Editor, pos: number): number {
  return Math.max(0, Math.min(pos, editor.state.doc.content.size))
}

export type UploadImageFn = (file: File, insertAt?: () => number) => Promise<void>

export async function hydrateImageUrls(
  doc: Record<string, unknown>,
  scope: NotesScope
): Promise<Record<string, unknown>> {
  const clone = structuredClone(doc) as {
    content?: Array<{ type?: string; attrs?: { key?: string; src?: string }; content?: unknown[] }>
  }

  async function walk(nodes: typeof clone.content) {
    if (!nodes) return
    for (const node of nodes) {
      if (node.type === 'image' && node.attrs?.key) {
        const url = await resolveImageSrc(scope, node.attrs.key)
        if (url) node.attrs.src = url
      }
      if (Array.isArray(node.content)) {
        await walk(node.content as typeof clone.content)
      }
    }
  }

  await walk(clone.content)
  return clone as Record<string, unknown>
}
