'use client'

/**
 * Per-capture notebook — TipTap doc with emoji, links, and uploaded images.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import styles from './dashboard.module.css'
import {
  EMPTY_NOTE_DOC,
  type NoteImageUpload,
  type SourceNote,
} from '@/lib/notes'
import { relativeTime } from '@/lib/dashboard-data'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const EMOJIS = [
  '✨', '💡', '🔥', '✅', '❓', '📌', '🧠', '📎', '🔗', '📝',
  '⭐', '🎯', '⚠️', '🚀', '💬', '📖',
]

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
})

interface SourceNotesProps {
  sourceId: string
  initialNote: SourceNote
}

async function resolveImageSrc(sourceId: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/sources/${sourceId}/artifact-url?key=${encodeURIComponent(key)}`
    )
    if (!res.ok) return null
    const data = (await res.json()) as { url: string }
    return data.url
  } catch {
    return null
  }
}

async function hydrateImageUrls(
  doc: Record<string, unknown>,
  sourceId: string
): Promise<Record<string, unknown>> {
  const clone = structuredClone(doc) as {
    content?: Array<{ type?: string; attrs?: { key?: string; src?: string }; content?: unknown[] }>
  }

  async function walk(nodes: typeof clone.content) {
    if (!nodes) return
    for (const node of nodes) {
      if (node.type === 'image' && node.attrs?.key) {
        const url = await resolveImageSrc(sourceId, node.attrs.key)
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

export default function SourceNotes({ sourceId, initialNote }: SourceNotesProps) {
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(initialNote.updated_at)
  const [error, setError] = useState<string | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      NoteImage.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({
        placeholder: 'Jot what you want to remember from this capture…',
      }),
    ],
    content: EMPTY_NOTE_DOC,
    immediatelyRender: false,
    onUpdate: () => setDirty(true),
    editorProps: {
      attributes: {
        class: styles.notesEditor,
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    let cancelled = false
    void (async () => {
      const hydrated = await hydrateImageUrls(
        (initialNote.content as Record<string, unknown>) || EMPTY_NOTE_DOC,
        sourceId
      )
      if (cancelled) return
      editor.commands.setContent(hydrated)
      setDirty(false)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [editor, initialNote.content, sourceId])

  useEffect(() => {
    if (!emojiOpen) return
    const onDoc = (event: MouseEvent) => {
      if (!emojiRef.current?.contains(event.target as Node)) setEmojiOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [emojiOpen])

  const handleSave = useCallback(async () => {
    if (!editor || saving) return
    setSaving(true)
    setError(null)
    try {
      const content = editor.getJSON() as Record<string, unknown>
      const res = await fetch(`/api/sources/${sourceId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw Error(`status ${res.status}`)
      const data = (await res.json()) as SourceNote
      setSavedAt(data.updated_at)
      setDirty(false)
    } catch (caught) {
      console.error('Failed to save note:', caught)
      setError('Couldn’t save — try again.')
    } finally {
      setSaving(false)
    }
  }, [editor, saving, sourceId])

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
      const mint = await fetch(`/api/sources/${sourceId}/note-images`, {
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
        (await resolveImageSrc(sourceId, signed.key)) ?? URL.createObjectURL(file)
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

  const isEmpty =
    !initialNote.updated_at &&
    !dirty &&
    ready &&
    editor?.isEmpty

  return (
    <section className={styles.notesSection} aria-label="Your notes">
      <div className={styles.capturePlate}>
        <span className={styles.capturePlateIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7">
            <path d="M6 4h9l3 3v13H6z" />
            <path d="M15 4v3h3M9 12h6M9 16h4" />
          </svg>
        </span>
        <div className={styles.capturePlateCopy}>
          <span className={styles.capturePlateNum}>05</span>
          <span className={styles.capturePlateTitle}>Your notes</span>
        </div>
        <span className={styles.capturePlateLine} />
      </div>

      <div className={styles.notesCard}>
        <div className={styles.notesToolbar}>
          <button
            type="button"
            className={styles.notesTool}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            aria-label="Bold"
            data-active={editor?.isActive('bold') ? 'true' : undefined}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className={styles.notesTool}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            aria-label="Italic"
            data-active={editor?.isActive('italic') ? 'true' : undefined}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            className={styles.notesTool}
            disabled={!editor}
            onClick={setLink}
            aria-label="Add link"
            data-active={editor?.isActive('link') ? 'true' : undefined}
          >
            Link
          </button>
          <div className={styles.notesEmojiWrap} ref={emojiRef}>
            <button
              type="button"
              className={styles.notesTool}
              disabled={!editor}
              onClick={() => setEmojiOpen(open => !open)}
              aria-label="Add emoji"
              aria-expanded={emojiOpen}
            >
              Emoji
            </button>
            {emojiOpen ? (
              <div className={styles.notesEmojiPanel} role="listbox" aria-label="Emojis">
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
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.notesTool}
            disabled={!editor}
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
            disabled={!editor || !dirty || saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <EditorContent editor={editor} />
      </div>
    </section>
  )
}
