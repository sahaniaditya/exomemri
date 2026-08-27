'use client'

/**
 * Submit or edit a product review. Native <dialog> + showModal(), matching
 * NewSpaceDialog / NewFolderDialog for focus, Esc, and backdrop.
 */
import { useEffect, useRef, useState } from 'react'

import type { Review } from '@/lib/reviews'
import styles from './dashboard.module.css'

const MIN_BODY = 10
const MAX_BODY = 1000

function GiveReviewForm({
  existing,
  onClose,
  onSaved,
}: {
  existing: Review | null
  onClose: () => void
  onSaved?: (review: Review) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [hoverRating, setHoverRating] = useState(0)
  const [body, setBody] = useState(existing?.body ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
  }, [])

  function close() {
    onClose()
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (rating < 1 || rating > 5) {
      setError('Pick a rating from 1 to 5 stars.')
      return
    }
    const trimmed = body.trim()
    if (trimmed.length < MIN_BODY) {
      setError(`Write at least ${MIN_BODY} characters.`)
      return
    }
    if (trimmed.length > MAX_BODY) {
      setError(`Keep it under ${MAX_BODY} characters.`)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, body: trimmed }),
      })

      if (res.status === 401) {
        setError('Your session has expired. Please log in again.')
        return
      }
      if (res.status === 422) {
        setError('Check your rating and review text, then try again.')
        return
      }
      if (!res.ok) {
        setError('Could not save your review. Please try again.')
        return
      }

      const saved = (await res.json()) as Review
      onSaved?.(saved)
      close()
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const displayRating = hoverRating || rating

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={event => {
        event.preventDefault()
        close()
      }}
      onClose={close}
    >
      <form className={styles.dialogForm} onSubmit={submit}>
        <h2 className={styles.dialogTitle}>
          {existing ? 'Edit your review' : 'Give a review'}
        </h2>
        <p className={styles.dialogSub}>
          Tell others how exomemri fits your learning — rating and a short note.
        </p>

        <span className={styles.dialogLabel} id="review-rating-label">
          Rating
        </span>
        <div
          className={styles.ratingStars}
          role="radiogroup"
          aria-labelledby="review-rating-label"
          onMouseLeave={() => setHoverRating(0)}
        >
          {[1, 2, 3, 4, 5].map(value => {
            const active = value <= displayRating
            return (
              <button
                key={value}
                type="button"
                className={`${styles.ratingStar} ${active ? styles.ratingStarActive : ''}`}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                aria-checked={rating === value}
                role="radio"
                onMouseEnter={() => setHoverRating(value)}
                onClick={() => setRating(value)}
              >
                ★
              </button>
            )
          })}
        </div>

        <label className={styles.dialogLabel} htmlFor="review-body">
          Your review
        </label>
        <textarea
          id="review-body"
          className={styles.dialogTextarea}
          value={body}
          onChange={event => setBody(event.target.value)}
          placeholder="What changed about how you learn?"
          maxLength={MAX_BODY}
          rows={4}
          required
        />

        {error && <div className={styles.dialogError}>{error}</div>}

        <div className={styles.dialogActions}>
          <button type="button" className={styles.dialogCancel} onClick={close}>
            Cancel
          </button>
          <button type="submit" className={styles.dialogSubmit} disabled={loading}>
            {loading ? 'Saving…' : existing ? 'Update review' : 'Submit review'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

export default function GiveReviewDialog({
  open,
  onClose,
  existing,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  existing: Review | null
  onSaved?: (review: Review) => void
}) {
  if (!open) return null
  return (
    <GiveReviewForm
      key={existing?.updated_at ?? existing?.id ?? 'new'}
      existing={existing}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

export function GiveReviewButton() {
  const [open, setOpen] = useState(false)
  const [existing, setExisting] = useState<Review | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/reviews/me')
        if (cancelled) return
        if (res.status === 404) {
          setExisting(null)
        } else if (res.ok) {
          setExisting((await res.json()) as Review)
        }
      } catch {
        // Button still works; dialog starts blank if load fails.
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <button
        type="button"
        className={styles.plateAction}
        onClick={() => setOpen(true)}
      >
        {loaded && existing ? 'Edit review' : 'Give review'}
      </button>
      <GiveReviewDialog
        open={open}
        onClose={() => setOpen(false)}
        existing={existing}
        onSaved={setExisting}
      />
    </>
  )
}
