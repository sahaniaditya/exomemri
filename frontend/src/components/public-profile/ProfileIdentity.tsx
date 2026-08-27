import styles from './public-profile.module.css'

function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c1 1 1.5 2.5 1.5 4a4.5 4.5 0 0 1-9 0C7.5 9 12 7 12 2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 3 3 8l9 5 9-5-9-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M3 12l9 5 9-5M3 16l9 5 9-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m15 9-4 2-2 4 4-2 2-4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface ProfileIdentityProps {
  fullName: string
  username: string
  currentStreak: number
  totalSources: number
  spaceCount: number
}

function initialsFrom(fullName: string): string {
  return (
    fullName
      .split(' ')
      .map(part => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}

/** Profile card — avatar + name, with three nested stat tiles. */
export default function ProfileIdentity({
  fullName,
  username,
  currentStreak,
  totalSources,
  spaceCount,
}: ProfileIdentityProps) {
  const hasStreak = currentStreak > 0

  return (
    <header className={styles.heroCard}>
      <div className={styles.identityHead}>
        <div className={styles.avatar} aria-hidden="true">
          {initialsFrom(fullName)}
        </div>
        <div className={styles.identityText}>
          <h1 className={styles.name}>{fullName}</h1>
          <p className={styles.handle}>@{username}</p>
        </div>
      </div>

      <ul className={styles.statRow} aria-label="Profile stats">
        <li className={`${styles.stat} ${hasStreak ? styles.statFlame : ''}`}>
          <span className={styles.statIcon} aria-hidden="true">
            <FlameIcon />
          </span>
          <div className={styles.statCopy}>
            <span className={styles.statVal}>{currentStreak}</span>
            <span className={styles.statKey}>
              day{currentStreak === 1 ? '' : 's'} streak
            </span>
          </div>
        </li>

        <li className={styles.stat}>
          <span className={styles.statIcon} aria-hidden="true">
            <StackIcon />
          </span>
          <div className={styles.statCopy}>
            <span className={styles.statVal}>{totalSources}</span>
            <span className={styles.statKey}>
              {totalSources === 1 ? 'source' : 'sources'} captured
            </span>
          </div>
        </li>

        <li className={styles.stat}>
          <span className={styles.statIcon} aria-hidden="true">
            <CompassIcon />
          </span>
          <div className={styles.statCopy}>
            <span className={styles.statVal}>{spaceCount}</span>
            <span className={styles.statKey}>
              learning {spaceCount === 1 ? 'space' : 'spaces'}
            </span>
          </div>
        </li>
      </ul>
    </header>
  )
}
