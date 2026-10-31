'use client'

/**
 * Ctrl/Cmd+K page switcher: debounced full-text search over the space's
 * pages, recent pages when the box is empty, arrow keys + Enter, Escape closes.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { searchNotes } from '@/lib/notes/client'
import { NO_ICON, SEARCH_DEBOUNCE_MS } from '@/lib/notes/constants'
import { loadRecent } from '@/lib/notes/storage'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import NotesModal from './NotesModal'
import styles from './notes.module.css'

interface QuickSwitcherProps {
  spaceId: string
  open: boolean
  onClose: () => void
  onSelect: (noteId: string) => void
}

interface Row {
  id: string
  title: string
  icon: string | null
  snippet?: string
}

export default function QuickSwitcher(props: QuickSwitcherProps) {
  return props.open ? <SwitcherDialog {...props} /> : null
}

function SwitcherDialog({ spaceId, onClose, onSelect }: QuickSwitcherProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Row[]>([])
  const [searching, setSearching] = useState(false)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const debounced = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS)
  const recent = useMemo(() => loadRecent(spaceId), [spaceId])
  const latest = useRef(0)

  useEffect(() => {
    if (!debounced) return
    const controller = new AbortController()
    const ticket = ++latest.current
    // eslint-disable-next-line react-hooks/set-state-in-effect -- request lifecycle flag
    setSearching(true)
    setFailed(false)
    searchNotes(spaceId, debounced, controller.signal)
      .then(hits => {
        if (ticket !== latest.current) return
        setResults(hits)
        setActive(0)
      })
      .catch(caught => {
        if (controller.signal.aborted || ticket !== latest.current) return
        console.error('Note search failed:', caught)
        setResults([])
        setFailed(true)
      })
      .finally(() => {
        if (ticket === latest.current) setSearching(false)
      })
    return () => controller.abort()
  }, [debounced, spaceId])

  const showingRecent = query.trim() === ''
  const rows: Row[] = showingRecent ? recent : results
  const current = Math.min(active, Math.max(rows.length - 1, 0))

  const choose = (row: Row | undefined) => {
    if (!row) return
    onSelect(row.id)
    onClose()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(rows.length ? (current + 1) % rows.length : 0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(rows.length ? (current - 1 + rows.length) % rows.length : 0)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(rows[current])
    }
  }

  const waiting = !showingRecent && (searching || query.trim() !== debounced)

  return (
    <NotesModal label="Search pages" onClose={onClose} hideHeader>
      <input
        data-autofocus
        className={styles.switchInput}
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={rows[current] ? `${listId}-${rows[current].id}` : undefined}
        aria-label="Search pages"
        placeholder="Search pages…"
        value={query}
        maxLength={100}
        onChange={event => {
          setQuery(event.target.value)
          setActive(0)
        }}
        onKeyDown={onKeyDown}
      />
      <div className={styles.modalBody}>
        {showingRecent && rows.length > 0 && <div className={styles.switchGroup}>Recent</div>}
        <ul id={listId} className={styles.switchList} role="listbox" aria-label="Pages">
          {rows.map((row, index) => (
            <li
              key={row.id}
              id={`${listId}-${row.id}`}
              role="option"
              aria-selected={index === current}
              className={`${styles.switchItem} ${index === current ? styles.switchItemActive : ''}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(row)}
            >
              <span className={styles.switchTitle}>
                <span aria-hidden="true">{row.icon || NO_ICON}</span>
                <span>{row.title}</span>
              </span>
              {row.snippet && <span className={styles.switchSnippet}>{row.snippet}</span>}
            </li>
          ))}
        </ul>
        {showingRecent && rows.length === 0 && (
          <p className={styles.modalEmpty}>Type to search your pages.</p>
        )}
        {!showingRecent && !waiting && !failed && rows.length === 0 && (
          <p className={styles.modalEmpty}>No pages match “{query.trim()}”.</p>
        )}
        {waiting && rows.length === 0 && <p className={styles.modalEmpty}>Searching…</p>}
        {failed && (
          <p className={styles.modalError} role="alert">
            Search failed. Try again.
          </p>
        )}
      </div>
    </NotesModal>
  )
}
