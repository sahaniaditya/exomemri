'use client'
/**
 * First viewport for a Learning Space — name, goal, real source mix, and a
 * path into the knowledge map. Account chrome lives here so the page doesn't
 * stack a second greeting under the overview TopBar.
 */
import Link from 'next/link'
import { type Profile } from '@/lib/profile'
import { relativeTime } from '@/lib/dashboard-data'
import type { Space } from '@/lib/spaces'
import AccountChrome from './AccountChrome'
import DeleteSpaceButton from './DeleteSpaceButton'
import styles from './dashboard.module.css'

interface SpaceHeroProps {
  space: Space
  profile: Profile | null
  sourceCount: number
}

const MIX: { key: keyof Space['source_counts']; label: string }[] = [
  { key: 'youtube', label: 'Videos' },
  { key: 'article', label: 'Articles' },
  { key: 'pdf', label: 'PDFs' },
  { key: 'ai_chat', label: 'Chats' },
  { key: 'note', label: 'Notes' },
]

export default function SpaceHero({ space, profile, sourceCount }: SpaceHeroProps) {
  const empty = sourceCount === 0
  const activeMix = MIX.filter(item => space.source_counts[item.key] > 0)

  return (
    <header className={styles.spaceHero}>
      <div className={styles.spaceHeroTop}>
        <div className={styles.spaceHeroCopy}>
          <div className={styles.spaceBreadcrumb}>
            <Link href="/dashboard">Overview</Link>
            <span aria-hidden="true">/</span>
            <span>Learning Space</span>
          </div>
          <h1 className={styles.spaceTitle}>{space.name}</h1>
          <p className={styles.spaceGoal}>
            {space.goal_text?.trim()
              ? space.goal_text
              : empty
                ? 'No goal set yet — capture something into this space to give it a spine.'
                : 'Everything you save here lands in one memory for this topic.'}
          </p>
          <div className={styles.spaceMetaRow}>
            <span>
              {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
            </span>
            <span className={styles.metaSep} aria-hidden="true">
              ·
            </span>
            <span>
              Last active{' '}
              {space.last_captured_at
                ? relativeTime(space.last_captured_at)
                : 'never'}
            </span>
          </div>
          <div className={styles.spaceHeroActions}>
            <DeleteSpaceButton spaceId={space.id} name={space.name} />
          </div>
        </div>
        <div className={styles.topRight}>
          <AccountChrome profile={profile} showStreak={false} />
        </div>
      </div>
      <div className={styles.spacePulse} aria-label="Sources in this space">
        <div className={styles.pulseCard}>
          <div className={styles.pulseVal}>{sourceCount}</div>
          <div className={styles.pulseKey}>In this space</div>
          <div className={styles.pulseHint}>
            {empty ? 'Waiting for a first capture' : 'Saved into this topic'}
          </div>
        </div>
        <div className={`${styles.pulseCard} ${styles.spaceMixCard}`}>
          <div className={styles.pulseKey}>Source mix</div>
          {activeMix.length === 0 ? (
            <div className={styles.pulseHint}>No types yet</div>
          ) : (
            <div className={styles.spaceMix}>
              {activeMix.map(item => (
                <span key={item.key} className={styles.kindChip}>
                  <strong>{space.source_counts[item.key]}</strong> {item.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <Link
          className={styles.pulseCta}
          href={`/dashboard/spaces/${space.id}/map`}
        >
          <span className={styles.pulseCtaEyebrow}>Explore</span>
          <span className={styles.pulseCtaTitle}>Open knowledge map</span>
          <span className={styles.pulseCtaArrow} aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </header>
  )
}
