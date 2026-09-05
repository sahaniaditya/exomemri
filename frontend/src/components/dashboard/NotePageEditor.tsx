'use client'

/**
 * TipTap editor for one named note page. Mounted only while the page is open.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import NoteImageView from './NoteImageView'
import styles from './dashboard.module.css'
import {
  EMPTY_NOTE_DOC,
  notesApiBase,
  notesArtifactUrlPath,
  type NoteImageUpload,
  type NotePage,
  type NotesScope,
} from '@/lib/notes'
import { relativeTime } from '@/lib/dashboard-data'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const EMOJIS = [
  '✨', '💡', '🔥', '✅', '❓', '📌', '🧠', '📎', '🔗', '📝',
  '⭐', '🎯', '⚠️', '🚀', '💬', '📖',
]

const EMOJI_PANEL_WIDTH = 240
const EMOJI_PANEL_GAP = 6
const EMOJI_PANEL_VIEWPORT_MARGIN = 8

interface EmojiPanelPosition {
  top: number
  left: number
}

/** Anchors the emoji panel to its trigger button, clamped so it never overflows the viewport. */
function computeEmojiPanelPosition(
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

const NoteImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      key: {
        default: null,
        parseHTML: element => element.getAttribute('data-key'),
        renderHTML: attributes =>
          attributes.key ? { 'data-key': attributes.key } : {},
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(NoteImageView)
  },
})

async function resolveImageSrc(scope: NotesScope, key: string): Promise<string | null> {
  try {
    const res = await fetch(notesArtifactUrlPath(scope, key))
    if (!res.ok) return null
    const data = (await res.json()) as { url: string }
    return data.url
  } catch {
    return null
  }
}

async function hydrateImageUrls(
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

interface NotePageEditorProps {
  scope: NotesScope
  pageId: string
  initialContent: Record<string, unknown>
  savedContent: Record<string, unknown>
  savedAt: string | null
  editable: boolean
  onDraft: (pageId: string, content: Record<string, unknown>) => void
  onSaved: (page: NotePage) => void
}

export default function NotePageEditor({
  scope,
  pageId,
  initialContent,
  savedContent,
  savedAt: savedAtProp,
  editable,
  onDraft,
  onSaved,
}: NotePageEditorProps) {
  const apiBase = notesApiBase(scope)
  const scopeKey =
    scope.kind === 'source' ? `source:${scope.sourceId}` : `space:${scope.spaceId}`
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(savedAtProp)
  const [error, setError] = useState<string | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [emojiPos, setEmojiPos] = useState<EmojiPanelPosition | null>(null)
  const [ready, setReady] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)
  const emojiPanelRef = useRef<HTMLDivElement>(null)
  const initialContentRef = useRef(initialContent)
  const savedContentRef = useRef(savedContent)
  const readyRef = useRef(false)
  const dirtyRef = useRef(false)

  useEffect(() => {
    readyRef.current = ready
  }, [ready])

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      NoteImage.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({
        placeholder:
          scope.kind === 'space'
            ? 'Jot what you want to remember about this space…'
            : 'Jot what you want to remember from this capture…',
      }),
    ],
    content: EMPTY_NOTE_DOC,
    immediatelyRender: false,
    editable: false,
    onUpdate: () => {
      if (editable) setDirty(true)
    },
    editorProps: {
      attributes: {
        class: styles.notesEditor,
      },
    },
  })

  useEffect(() => {
    editor?.setEditable(Boolean(editable && ready))
  }, [editor, editable, ready])

  useEffect(() => {
    if (!editor) return
    let cancelled = false
    void (async () => {
      const hydrated = await hydrateImageUrls(
        initialContentRef.current || EMPTY_NOTE_DOC,
        scope
      )
      if (cancelled) return
      editor.commands.setContent(hydrated)
      const restored = JSON.stringify(initialContentRef.current)
      const saved = JSON.stringify(savedContentRef.current)
      setDirty(restored !== saved)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [editor, scopeKey]) // eslint-disable-line react-hooks/exhaustive-deps -- scopeKey tracks scope identity

  useEffect(() => {
    if (!editor) return
    return () => {
      if (readyRef.current && dirtyRef.current) {
        onDraft(pageId, editor.getJSON() as Record<string, unknown>)
      }
    }
  }, [editor, onDraft, pageId])

  useEffect(() => {
    if (!emojiOpen) return
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node
      // The panel is portaled to document.body, so it's no longer a descendant of
      // emojiRef — check both the trigger's wrapper and the portaled panel itself.
      if (emojiRef.current?.contains(target)) return
      if (emojiPanelRef.current?.contains(target)) return
      setEmojiOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [emojiOpen])

  useLayoutEffect(() => {
    if (!emojiOpen) return
    const reposition = () => {
      const anchor = emojiButtonRef.current
      if (!anchor) return
      const anchorRect = anchor.getBoundingClientRect()
      const panel = emojiPanelRef.current
      const panelSize = {
        width: panel?.offsetWidth ?? EMOJI_PANEL_WIDTH,
        height: panel?.offsetHeight ?? 0,
      }
      setEmojiPos(computeEmojiPanelPosition(anchorRect, panelSize))
    }
    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
      setEmojiPos(null)
    }
  }, [emojiOpen])

  const handleSave = useCallback(async () => {
    if (!editor || saving) return
    setSaving(true)
    setError(null)
    try {
      const content = editor.getJSON() as Record<string, unknown>
      const res = await fetch(`${apiBase}/notes/${pageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.status === 401) {
        setError('Your session has expired. Please log in again.')
        return
      }
      if (!res.ok) throw Error(`status ${res.status}`)
      const data = (await res.json()) as NotePage
      setSavedAt(data.updated_at)
      setDirty(false)
      onDraft(pageId, data.content)
      onSaved(data)
    } catch (caught) {
      console.error('Failed to save note:', caught)
      setError('Couldn’t save — try again.')
    } finally {
      setSaving(false)
    }
  }, [apiBase, editor, onDraft, onSaved, pageId, saving])

  const setLink = () => {
    if (!editor) return
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', previous ?? 'https://')
    if (url === null) return
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  const uploadImage = async (file: File) => {
    if (!editor) return
    if (!file.type.startsWith('image/')) {
      setError('Only image files are supported.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image must be under 5 MB.')
      return
    }
    setError(null)
    try {
      const mint = await fetch(`${apiBase}/note-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_type: file.type, filename: file.name }),
      })
      if (!mint.ok) throw Error(`mint ${mint.status}`)
      const signed = (await mint.json()) as NoteImageUpload
      const put = await fetch(signed.upload_url, {
        method: 'PUT',
        headers: { 'x-upsert': 'true', 'content-type': file.type },
        body: file,
      })
      if (!put.ok) throw Error(`upload ${put.status}`)

      const display =
        (await resolveImageSrc(scope, signed.key)) ?? URL.createObjectURL(file)
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'image',
          attrs: { src: display, alt: file.name, key: signed.key },
        })
        .run()
      setDirty(true)
    } catch (caught) {
      console.error('Note image upload failed:', caught)
      setError('Image upload failed — try again.')
    }
  }

  const isEmpty = !savedAt && !dirty && ready && editor?.isEmpty

  return (
    <div className={styles.notesPageBody} id={`note-body-${pageId}`}>
      {editable ? (
        <div className={styles.notesToolbar}>
          <button
            type="button"
            className={styles.notesTool}
            disabled={!editor || !ready}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            aria-label="Bold"
            data-active={editor?.isActive('bold') ? 'true' : undefined}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className={styles.notesTool}
            disabled={!editor || !ready}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            aria-label="Italic"
            data-active={editor?.isActive('italic') ? 'true' : undefined}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            className={styles.notesTool}
            disabled={!editor || !ready}
            onClick={setLink}
            aria-label="Add link"
            data-active={editor?.isActive('link') ? 'true' : undefined}
          >
            Link
          </button>
          <div className={styles.notesEmojiWrap} ref={emojiRef}>
            <button
              type="button"
              ref={emojiButtonRef}
              className={styles.notesTool}
              disabled={!editor || !ready}
              onClick={() => setEmojiOpen(open => !open)}
              aria-label="Add emoji"
              aria-expanded={emojiOpen}
            >
              Emoji
            </button>
            {emojiOpen
              ? createPortal(
                  <div
                    ref={emojiPanelRef}
                    className={styles.notesEmojiPanel}
                    role="listbox"
                    aria-label="Emojis"
                    style={{
                      top: emojiPos?.top ?? 0,
                      left: emojiPos?.left ?? 0,
                      opacity: emojiPos ? 1 : 0,
                      pointerEvents: emojiPos ? 'auto' : 'none',
                    }}
                  >
                    {EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        className={styles.notesEmojiBtn}
                        onClick={() => {
                          editor?.chain().focus().insertContent(emoji).run()
                          setEmojiOpen(false)
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>,
                  document.body
                )
              : null}
          </div>
          <button
            type="button"
            className={styles.notesTool}
            disabled={!editor || !ready}
            onClick={() => fileRef.current?.click()}
            aria-label="Upload image"
          >
            Image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className={styles.notesFileInput}
            onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void uploadImage(file)
            }}
          />
          <div className={styles.notesToolbarSpacer} />
          <span className={styles.notesSaveMeta}>
            {error ? (
              <span className={styles.notesError}>{error}</span>
            ) : dirty ? (
              'Unsaved changes'
            ) : savedAt ? (
              `Saved · ${relativeTime(savedAt)}`
            ) : isEmpty ? (
              'Nothing saved yet'
            ) : (
              'Saved'
            )}
          </span>
          <button
            type="button"
            className={styles.notesSave}
            disabled={!editor || !ready || !dirty || saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : null}
      {ready ? (
        <EditorContent editor={editor} />
      ) : (
        <div className={styles.notesEditor} aria-busy="true" />
      )}
    </div>
  )
}
