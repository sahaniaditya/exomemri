'use client'

/**
 * The shared TipTap editor for the full-page note: toolbar, content, slash menu, image
 * upload and paste handling. It owns no persistence; the parent (NoteCanvas) saves.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import dashboardStyles from '@/components/dashboard/dashboard.module.css'
import { EMPTY_NOTE_DOC, clipboardLooksLikeCode, type NotesScope } from '@/lib/notes'
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  collectClipboardImages,
  hydrateImageUrls,
  insertPastedCode,
  isImageOnlyClipboard,
  isUploadableImage,
  type UploadImageFn,
} from '@/lib/notes/editor-utils'
import { buildNoteExtensions } from './extensions'
import { useNoteImageUpload } from './hooks/useNoteImageUpload'
import NoteEmojiButton from './NoteEmojiButton'
import SlashMenu from './SlashMenu'
import { NOTE_PICK_IMAGE_EVENT } from './slash/items-basic'
import styles from './notes.module.css'

interface NoteEditorCoreProps {
  scope: NotesScope
  initialContent: Record<string, unknown>
  editable?: boolean
  /** Called for every user edit (not for the initial load). */
  onChange: () => void
  onBlur?: () => void
  onEditorReady?: (editor: Editor | null) => void
}

export default function NoteEditorCore({
  scope,
  initialContent,
  editable = true,
  onChange,
  onBlur,
  onEditorReady,
}: NoteEditorCoreProps) {
  const scopeKey =
    scope.kind === 'source' ? `source:${scope.sourceId}` : `space:${scope.spaceId}`
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const readyRef = useRef(false)
  const editableRef = useRef(editable)
  const initialContentRef = useRef(initialContent)
  const editorRef = useRef<Editor | null>(null)
  const uploadImageRef = useRef<UploadImageFn>(async () => {})
  const onChangeRef = useRef(onChange)
  const onBlurRef = useRef(onBlur)
  const setErrorRef = useRef(setError)

  useEffect(() => {
    onChangeRef.current = onChange
    onBlurRef.current = onBlur
    editableRef.current = editable
  })

  const extensions = useMemo(
    () => buildNoteExtensions(scope),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scopeKey tracks scope identity
    [scopeKey]
  )

  const editor = useEditor({
    extensions,
    content: EMPTY_NOTE_DOC,
    immediatelyRender: false,
    editable: false,
    onUpdate: () => {
      if (readyRef.current && editableRef.current) onChangeRef.current()
    },
    onBlur: () => onBlurRef.current?.(),
    editorProps: {
      attributes: { class: `${dashboardStyles.notesEditor} ${styles.prose}` },
      handlePaste(view, event) {
        if (!editableRef.current || !readyRef.current) return false
        const data = event.clipboardData
        if (!data) return false
        const images = collectClipboardImages(event)
        const uploadable = images.filter(isUploadableImage)
        if (uploadable.length) {
          if (!isImageOnlyClipboard(data)) return false
          event.preventDefault()
          const editorInstance = editorRef.current
          const posRef = { current: view.state.selection.from }
          const onTransaction = ({
            transaction,
          }: {
            transaction: { mapping: { map: (p: number) => number } }
          }) => {
            posRef.current = transaction.mapping.map(posRef.current)
          }
          editorInstance?.on('transaction', onTransaction)
          void (async () => {
            try {
              for (const file of uploadable) {
                await uploadImageRef.current(file, () => posRef.current)
              }
            } finally {
              editorInstance?.off('transaction', onTransaction)
            }
          })()
          return true
        }
        if (images.length && isImageOnlyClipboard(data)) {
          const tooBig = images.some(
            file => ALLOWED_IMAGE_TYPES.has(file.type) && file.size > MAX_IMAGE_BYTES
          )
          setErrorRef.current(
            tooBig ? 'Image must be under 5 MB.' : 'Only image files are supported.'
          )
          event.preventDefault()
          return true
        }
        const editorInstance = editorRef.current
        if (!editorInstance) return false
        if (images.length && !editorInstance.isActive('codeBlock')) {
          // Mixed image + text: don't steal the paste until there is a real mixed path.
          return false
        }
        const text = data.getData('text/plain')
        if (!text.trim()) return false
        if (editorInstance.isActive('codeBlock') || clipboardLooksLikeCode(data)) {
          event.preventDefault()
          insertPastedCode(editorInstance, text)
          return true
        }
        return false
      },
    },
  })

  const { uploadImage, uploading } = useNoteImageUpload({ scope, editor, onError: setError })

  useEffect(() => {
    uploadImageRef.current = uploadImage
  }, [uploadImage])

  useEffect(() => {
    editorRef.current = editor ?? null
    onEditorReady?.(editor ?? null)
    return () => onEditorReady?.(null)
  }, [editor, onEditorReady])

  useEffect(() => {
    readyRef.current = ready
    editor?.setEditable(Boolean(editable && ready), false)
  }, [editor, editable, ready])

  // Load the document once, re-minting signed URLs for stored image keys.
  useEffect(() => {
    if (!editor) return
    let cancelled = false
    void (async () => {
      const hydrated = await hydrateImageUrls(
        initialContentRef.current || EMPTY_NOTE_DOC,
        scope
      )
      if (cancelled || editor.isDestroyed) return
      editor.commands.setContent(hydrated, { emitUpdate: false })
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [editor, scopeKey]) // eslint-disable-line react-hooks/exhaustive-deps -- scopeKey tracks scope identity

  // The Image slash item asks for the file picker through a DOM event.
  useEffect(() => {
    const dom = editor?.view.dom
    if (!dom) return
    const open = () => fileRef.current?.click()
    dom.addEventListener(NOTE_PICK_IMAGE_EVENT, open)
    return () => dom.removeEventListener(NOTE_PICK_IMAGE_EVENT, open)
  }, [editor, ready])

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

  const disabled = !editor || !ready

  return (
    <div className={styles.core}>
      {editable ? (
        <div className={`${dashboardStyles.notesToolbar} ${styles.toolbar}`}>
          <button
            type="button"
            className={dashboardStyles.notesTool}
            disabled={disabled}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            aria-label="Bold"
            data-active={editor?.isActive('bold') ? 'true' : undefined}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className={dashboardStyles.notesTool}
            disabled={disabled}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            aria-label="Italic"
            data-active={editor?.isActive('italic') ? 'true' : undefined}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            className={dashboardStyles.notesTool}
            disabled={disabled}
            onClick={setLink}
            aria-label="Add link"
            data-active={editor?.isActive('link') ? 'true' : undefined}
          >
            Link
          </button>
          <button
            type="button"
            className={dashboardStyles.notesTool}
            disabled={disabled}
            onClick={() => editor?.chain().focus().toggleCode().run()}
            aria-label="Inline code"
            data-active={editor?.isActive('code') ? 'true' : undefined}
          >
            <code>{'</>'}</code>
          </button>
          <button
            type="button"
            className={dashboardStyles.notesTool}
            disabled={disabled}
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            aria-label="Code snippet"
            data-active={editor?.isActive('codeBlock') ? 'true' : undefined}
          >
            Code
          </button>
          <NoteEmojiButton
            disabled={disabled}
            onPick={emoji => editor?.chain().focus().insertContent(emoji).run()}
          />
          <button
            type="button"
            className={dashboardStyles.notesTool}
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
            aria-label="Upload image"
          >
            Image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className={dashboardStyles.notesFileInput}
            data-testid="note-image-input"
            onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void uploadImage(file)
            }}
          />
          <span className={styles.toolbarStatus} role="status">
            {error ? (
              <span className={dashboardStyles.notesError}>{error}</span>
            ) : uploading ? (
              'Uploading image…'
            ) : null}
          </span>
        </div>
      ) : null}
      {ready ? (
        <EditorContent editor={editor} />
      ) : (
        <div className={dashboardStyles.notesEditor} aria-busy="true" />
      )}
      <SlashMenu editor={editor ?? null} />
    </div>
  )
}
