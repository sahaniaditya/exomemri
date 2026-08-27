'use client'

/**
 * Streak + theme toggle + signed-in account card. Used in TopBar / SpaceHero
 * on desktop and in the mobile nav drawer beside the menus.
 */
import { useLogout } from '@/lib/use-logout'
import { formatCredits, type CreditsBalance } from '@/lib/credits'
import { initial, type Profile } from '@/lib/profile'
import ThemeToggle from './ThemeToggle'
import styles from './dashboard.module.css'

interface AccountChromeProps {
  profile: Profile | null
  streakDays?: number
  credits?: CreditsBalance | null
  /** When false, hide the streak pill (e.g. SpaceHero). Default true. */
  showStreak?: boolean
}

export default function AccountChrome({
  profile,
  streakDays = 0,
  credits = null,
  showStreak = true,
}: AccountChromeProps) {
  const { logout, loggingOut } = useLogout()

  return (
    <div className={styles.accountChrome}>
      <div className={styles.accountChromeTools}>
        {showStreak && streakDays > 0 ? (
          <div className={styles.streak}>
            <span className={styles.flame} aria-hidden="true">
              🔥
            </span>
            {streakDays} day{streakDays === 1 ? '' : 's'}
          </div>
        ) : null}
        <ThemeToggle />
      </div>
      <div className={styles.me}>
        <div className={styles.avatar}>{initial(profile)}</div>
        <div className={styles.meCopy}>
          <div className={styles.nm}>{profile?.full_name ?? 'Your account'}</div>
          <div className={styles.pl}>
            {credits != null ? formatCredits(credits.balance) : 'SIGNED IN'}
          </div>
        </div>
        <button
          type="button"
          className={styles.signout}
          onClick={() => void logout()}
          disabled={loggingOut}
          title="Sign out"
          aria-label="Sign out"
        >
          <svg viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </div>
  )
}
