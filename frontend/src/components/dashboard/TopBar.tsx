'use client'

import { useSyncExternalStore } from 'react'

import styles from './dashboard.module.css'

interface TopBarProps {
  name: string
  dueCount: number
  newConcepts: number
  streakDays: number
}

interface Clock {
  greeting: string
  date: string
}

function greetingFor(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// Greeting and date depend on the viewer's clock and timezone, so the server
// render stays neutral and the real values arrive on hydration. The snapshot is
// memoised because useSyncExternalStore compares it by identity.
let clientClock: Clock | null = null

function getClientClock(): Clock {
  if (!clientClock) {
    const now = new Date()
    clientClock = {
      greeting: greetingFor(now.getHours()),
      date: now
        .toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
        .toUpperCase(),
    }
  }
  return clientClock
}

const subscribe = () => () => {}

export default function TopBar({ name, dueCount, newConcepts, streakDays }: TopBarProps) {
  const clock = useSyncExternalStore<Clock | null>(subscribe, getClientClock, () => null)

  return (
    <div className={styles.top}>
      <div className={styles.hello}>
        <div className={styles.coord}>{clock?.date ?? ''}</div>
        <h1>{clock ? `${clock.greeting}, ${name}.` : `Welcome back, ${name}.`}</h1>
        <p className={styles.sub}>
          You have <strong>{dueCount} cards</strong> due and picked up{' '}
          <strong>{newConcepts} new concepts</strong> yesterday.
        </p>
      </div>
      <div className={styles.streak}>
        <span className={styles.flame}>◆</span>{' '}
        <span>
          <strong>{streakDays}-day</strong>&nbsp;streak
        </span>
      </div>
    </div>
  )
}
