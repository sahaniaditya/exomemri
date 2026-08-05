'use client'

import { useState } from 'react'

import styles from './dashboard.module.css'

export default function AskBar() {
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: wire to the memory-query endpoint once the backend exposes it.
    if (!query.trim()) return
  }

  return (
    <form className={styles.ask} onSubmit={handleSubmit}>
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4-4" />
      </svg>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Ask your memory — “explain caching based on everything I’ve studied”"
        aria-label="Ask your memory"
        suppressHydrationWarning
      />
      <button type="submit" className={styles.go}>
        Ask
      </button>
    </form>
  )
}
