import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { atlasFontVars } from '@/lib/fonts'
import { getPublicProfile } from '@/lib/public-profile'
import dashboardStyles from '@/components/dashboard/dashboard.module.css'
import ContourBg from '@/components/dashboard/ContourBg'
import Plate from '@/components/dashboard/Plate'
import CoverageRing from '@/components/dashboard/CoverageRing'
import styles from './public-profile.module.css'
import Sidebar from '@/components/dashboard/Sidebar'

interface PublicProfilePageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { username } = await params
  return {
    title: `${username} · exomemri`,
    description: 'A public exomemri learning profile.',
  }
}

function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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

// Deliberately no cookies()/token read anywhere on this page — it renders
// the same for every visitor, logged in or not. Access is gated entirely by
// the backend's opt-in profile_public flag, not by anything client-side.
export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params
  const profile = await getPublicProfile(username)
  if (!profile) notFound()

  const totalSources = profile.spaces.reduce((sum, space) => sum + space.source_count, 0)
  const initials = profile.full_name
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const hasStreak = profile.current_streak > 0

  return (
    // dashboardStyles.app supplies the design-token custom properties
    // (--ink, --forest, --paper, etc). styles.shell overrides its
    // sidebar-oriented grid-template-columns: 246px 1fr — this page has
    // no sidebar, so that column was reserving dead space and squeezing
    // everything else into a too-narrow strip at every viewport width.
    <div className={`${dashboardStyles.app} ${styles.shell} ${atlasFontVars}`}>
      <main className={dashboardStyles.main}>
        <ContourBg />
        <div className={styles.inner}>
          <section className={`${dashboardStyles.section} ${styles.profileSection}`}>
            <Plate num="01" title="Profile" />
            <div className={styles.heroCard}>
              <div className={styles.hero}>
                <div className={styles.avatar} aria-hidden="true">
                  {initials || '?'}
                </div>
                <div className={styles.heroText}>
                  <h1 className={styles.name}>{profile.full_name}</h1>
                  <p className={styles.handle}>@{profile.username}</p>
                </div>
              </div>

              <div className={styles.statRow}>
                <div className={`${styles.stat} ${hasStreak ? styles.statFlame : ''}`}>
                  <span className={styles.statIcon}>
                    <FlameIcon />
                  </span>
                  <div className={styles.statCopy}>
                    <span className={styles.statVal}>{profile.current_streak}</span>
                    <span className={styles.statKey}>
                      day{profile.current_streak === 1 ? '' : 's'} streak
                    </span>
                  </div>
                </div>

                <div className={styles.stat}>
                  <span className={styles.statIcon}>
                    <StackIcon />
                  </span>
                  <div className={styles.statCopy}>
                    <span className={styles.statVal}>{totalSources}</span>
                    <span className={styles.statKey}>
                      {totalSources === 1 ? 'source' : 'sources'} captured
                    </span>
                  </div>
                </div>

                <div className={styles.stat}>
                  <span className={styles.statIcon}>
                    <CompassIcon />
                  </span>
                  <div className={styles.statCopy}>
                    <span className={styles.statVal}>{profile.spaces.length}</span>
                    <span className={styles.statKey}>
                      learning {profile.spaces.length === 1 ? 'space' : 'spaces'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={dashboardStyles.section}>
            <Plate num="02" title="Learning Spaces" />
            {profile.spaces.length === 0 ? (
              <div className={dashboardStyles.empty}>
                <p className={dashboardStyles.et}>No public spaces yet</p>
                <p>{profile.full_name.split(' ')[0]} hasn&apos;t shared any Learning Spaces.</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {profile.spaces.map(space => (
                  <div key={space.name} className={styles.spaceCard}>
                    <div className={styles.spaceAccent} aria-hidden="true" />
                    <div className={styles.spaceCardTop}>
                      <h4 className={styles.spaceTitle}>{space.name}</h4>
                      {space.coverage_pct !== null && (
                        <CoverageRing pct={space.coverage_pct} />
                      )}
                    </div>
                    <div className={styles.spaceCardFoot}>
                      <span className={styles.spaceCount}>{space.source_count}</span>
                      <span className={styles.spaceCountLabel}>
                        {space.source_count === 1 ? 'source' : 'sources'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}