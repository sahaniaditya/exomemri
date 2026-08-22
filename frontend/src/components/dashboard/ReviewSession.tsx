'use client'
import { useState } from 'react'
import styles from './dashboard.module.css'
import type { ReviewItem } from '@/lib/review'

interface ReviewSessionProps {
  spaceId: string
  initialItems: ReviewItem[]
}

export default function ReviewSession({ spaceId, initialItems }: ReviewSessionProps) {
  const [items] = useState(initialItems)
  const [index, setIndex] = useState(0)
  const [marking, setMarking] = useState(false)

  const current = items[index]

  const handleReviewed = async () => {
    if (!current || marking) return
    setMarking(true)
    try {
      const res = await fetch(`/api/spaces/${spaceId}/review/${current.id}/reviewed`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`status ${res.status}`)
      setIndex(i => i + 1)
    } catch (error) {
      console.error('Failed to mark this item reviewed:', error)
    } finally {
      setMarking(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className={styles.rcard}>
        <p className={styles.summarytext}>Nothing due for review right now.</p>
      </div>
    )
  }

  if (index >= items.length) {
    return (
      <div className={styles.rcard}>
        <p className={styles.summarytext}>
          Done — you reviewed {items.length} {items.length === 1 ? 'item' : 'items'}.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.rcard}>
      <div className={styles.summarylabel}>
        {index + 1} of {items.length}
      </div>
      <h4>{current.prompt_text}</h4>
      <p className={styles.summarytext}>From &ldquo;{current.source_title}&rdquo;</p>
      <button
        type="button"
        className={styles.railbtn}
        onClick={handleReviewed}
        disabled={marking}
      >
        Mark reviewed
      </button>
    </div>
  )
}
