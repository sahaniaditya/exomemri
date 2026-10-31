'use client'

/**
 * Page icon (emoji grid), cover image (upload / remove) and the full-width
 * toggle. Each change is one PATCH; the saved page is reported through
 * `onSaved` so the host can refresh its concurrency token (`updated_at`).
 */
import { useEffect, useState, type ChangeEvent } from 'react'
import { patchPage } from '@/lib/notes/client'
import { NO_ICON } from '@/lib/notes/constants'
import { CoverUploadError, resolveNoteImageUrl, uploadNoteImage } from '@/lib/notes/coverUpload'
import { PAGE_ICONS } from '@/lib/notes/emoji'
import type { NotePatch, WorkspacePage } from '@/lib/notes/types'
import styles from './notes.module.css'

interface NoteHeaderMetaProps {
  spaceId: string
  noteId: string
  icon: string | null
  coverKey: string | null
  fullWidth: boolean
  onSaved?: (page: WorkspacePage) => void
}

export default function NoteHeaderMeta({
  spaceId,
  noteId,
  icon,
  coverKey,
  fullWidth,
  onSaved,
}: NoteHeaderMetaProps) {
  const [current, setCurrent] = useState({ icon, coverKey, fullWidth })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Adopt new props during render (the supported alternative to a syncing effect).
  const [seen, setSeen] = useState({ icon, coverKey, fullWidth })
  if (seen.icon !== icon || seen.coverKey !== coverKey || seen.fullWidth !== fullWidth) {
    setSeen({ icon, coverKey, fullWidth })
    setCurrent({ icon, coverKey, fullWidth })
  }

  useEffect(() => {
    let alive = true
    if (!current.coverKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from the cover key
      setCoverUrl(null)
      return
    }
    void resolveNoteImageUrl(spaceId, current.coverKey).then(url => alive && setCoverUrl(url))
    return () => {
      alive = false
    }
  }, [spaceId, current.coverKey])

  const save = async (patch: NotePatch, fallback: string): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      const page = await patchPage(spaceId, noteId, patch)
      setCurrent({ icon: page.icon, coverKey: page.cover_key, fullWidth: page.full_width })
      onSaved?.(page)
      return true
    } catch (caught) {
      console.error('Saving page settings failed:', caught)
      setError(fallback)
      return false
    } finally {
      setBusy(false)
    }
  }

  const chooseIcon = async (next: string | null) => {
    setPickerOpen(false)
    await save({ icon: next }, 'Could not change the icon.')
  }

  const onCoverFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const key = await uploadNoteImage(spaceId, file)
      await save({ cover_key: key }, 'Could not save the cover.')
    } catch (caught) {
      console.error('Cover upload failed:', caught)
      setError(caught instanceof CoverUploadError ? caught.message : 'Image upload failed.')
      setBusy(false)
    }
  }

  return (
    <div className={styles.meta}>
      {current.coverKey && (
        <div className={styles.cover} data-testid="cover">
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            <img className={styles.coverImg} src={coverUrl} alt="" />
          )}
          <div className={styles.coverActions}>
            <label className={styles.btn}>
              Change cover
              <input
                className={styles.hiddenInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                aria-label="Change cover image"
                disabled={busy}
                onChange={onCoverFile}
              />
            </label>
            <button
              type="button"
              className={styles.btn}
              disabled={busy}
              onClick={() => void save({ cover_key: null }, 'Could not remove the cover.')}
            >
              Remove cover
            </button>
          </div>
        </div>
      )}

      <div className={styles.metaRow}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Change icon"
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          disabled={busy}
          onClick={() => setPickerOpen(open => !open)}
        >
          {current.icon || NO_ICON}
        </button>
        {current.icon && (
          <button type="button" className={styles.btnGhost} disabled={busy} onClick={() => void chooseIcon(null)}>
            Remove icon
          </button>
        )}
        {!current.coverKey && (
          <label className={styles.btnGhost}>
            Add cover
            <input
              className={styles.hiddenInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              aria-label="Add cover image"
              disabled={busy}
              onChange={onCoverFile}
            />
          </label>
        )}
        <label className={styles.metaToggle}>
          <input
            type="checkbox"
            checked={current.fullWidth}
            disabled={busy}
            onChange={event => void save({ full_width: event.target.checked }, 'Could not change the page width.')}
          />
          Full width
        </label>
        {error && (
          <span className={styles.metaError} role="alert">
            {error}
          </span>
        )}

        {pickerOpen && (
          <div className={styles.emojiPopover} role="dialog" aria-label="Choose an icon">
            <div className={styles.emojiGrid}>
              {PAGE_ICONS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  className={styles.emojiBtn}
                  aria-label={`Use ${emoji} as icon`}
                  onClick={() => void chooseIcon(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
