'use client'

/** The `@` suggestion list: this space's captures and pages. */
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import type { LinkableItem } from '@/lib/notes/linkables'
import styles from './notes.module.css'

export interface MentionPickerProps {
  items: LinkableItem[]
  loading?: boolean
  command: (item: LinkableItem) => void
}

export interface MentionPickerHandle {
  /** Returns true when the key was handled (arrows, Enter, Tab). */
  onKeyDown: (event: KeyboardEvent) => boolean
}

const MentionPicker = forwardRef<MentionPickerHandle, MentionPickerProps>(function MentionPicker(
  { items, loading, command },
  ref
) {
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    setSelected(0)
  }, [items])

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: event => {
        if (items.length === 0) return false
        if (event.key === 'ArrowDown') {
          setSelected(index => (index + 1) % items.length)
          return true
        }
        if (event.key === 'ArrowUp') {
          setSelected(index => (index - 1 + items.length) % items.length)
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          command(items[Math.min(selected, items.length - 1)])
          return true
        }
        return false
      },
    }),
    [items, selected, command]
  )

  if (items.length === 0) {
    return <div className={styles.suggestEmpty}>{loading ? 'Loading…' : 'No matches'}</div>
  }

  return (
    <div role="listbox" aria-label="Mention a capture or page">
      {items.map((item, index) => (
        <button
          key={`${item.kind}-${item.id}`}
          type="button"
          role="option"
          aria-selected={index === selected}
          className={`${styles.suggestItem} ${index === selected ? styles.suggestItemActive : ''}`}
          onMouseEnter={() => setSelected(index)}
          onMouseDown={event => {
            event.preventDefault()
            command(item)
          }}
        >
          <span aria-hidden="true">{item.kind === 'source' ? '📎' : item.detail || '📄'}</span>
          <span>{item.title}</span>
          <span className={styles.suggestKind}>{item.kind === 'source' ? 'Capture' : 'Page'}</span>
        </button>
      ))}
    </div>
  )
})

export default MentionPicker
