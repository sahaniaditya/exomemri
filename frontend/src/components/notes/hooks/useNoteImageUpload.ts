'use client'

/**
 * Note image upload: mint a signed URL through the BFF, PUT the bytes to storage, then
 * insert an `image` node carrying the storage key. Limits: 5 MB; jpeg/png/webp/gif.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { NoteImageUpload, NotesScope } from '@/lib/notes'
import { notesApiBase } from '@/lib/notes'
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  clampInsertPos,
  imageFilename,
  resolveImageSrc,
  type UploadImageFn,
} from '@/lib/notes/editor-utils'

export const SESSION_EXPIRED_UPLOAD_MESSAGE = 'Your session has expired. Please log in again.'

interface UseNoteImageUploadArgs {
  scope: NotesScope
  editor: Editor | null
  /** Receives a user-facing message, or `null` to clear it. */
  onError: (message: string | null) => void
}

export function useNoteImageUpload({
  scope,
  editor,
  onError,
}: UseNoteImageUploadArgs): { uploadImage: UploadImageFn; uploading: boolean } {
  const apiBase = notesApiBase(scope)
  const [uploading, setUploading] = useState(false)
  const uploadCountRef = useRef(0)
  const aliveRef = useRef(true)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onErrorRef.current = onError
  })

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  const uploadImage = useCallback<UploadImageFn>(
    async (file, insertAt) => {
      if (!editor) return
      const fail = (message: string | null) => onErrorRef.current(message)
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        fail('Only image files are supported.')
        return
      }
      if (file.size > MAX_IMAGE_BYTES) {
        fail('Image must be under 5 MB.')
        return
      }
      const filename = imageFilename(file)
      fail(null)
      uploadCountRef.current += 1
      setUploading(true)
      try {
        const mint = await fetch(`${apiBase}/note-images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_type: file.type, filename }),
        })
        if (!aliveRef.current || editor.isDestroyed) return
        if (mint.status === 401) {
          fail(SESSION_EXPIRED_UPLOAD_MESSAGE)
          return
        }
        if (!mint.ok) throw Error(`mint ${mint.status}`)
        const signed = (await mint.json()) as NoteImageUpload
        const put = await fetch(signed.upload_url, {
          method: 'PUT',
          headers: { 'x-upsert': 'true', 'content-type': file.type },
          body: file,
        })
        if (!aliveRef.current || editor.isDestroyed) return
        if (!put.ok) throw Error(`upload ${put.status}`)

        const display =
          (await resolveImageSrc(scope, signed.key)) ?? URL.createObjectURL(file)
        if (!aliveRef.current || editor.isDestroyed) return
        const node = {
          type: 'image',
          attrs: { src: display, alt: filename, key: signed.key },
        }
        if (insertAt) {
          editor
            .chain()
            .insertContentAt(clampInsertPos(editor, insertAt()), node)
            .run()
        } else {
          editor.chain().focus().insertContent(node).run()
        }
      } catch (caught) {
        console.error('Note image upload failed:', caught)
        if (aliveRef.current) fail('Image upload failed — try again.')
      } finally {
        uploadCountRef.current -= 1
        if (uploadCountRef.current <= 0) {
          uploadCountRef.current = 0
          if (aliveRef.current) setUploading(false)
        }
      }
    },
    [apiBase, editor, scope]
  )

  return { uploadImage, uploading }
}
