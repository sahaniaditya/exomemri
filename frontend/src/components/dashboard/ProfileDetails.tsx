import {
  formatProfileDate,
  initial,
  longestStreak,
  streakDays,
  type Profile,
} from '@/lib/profile'
import styles from './dashboard.module.css'

interface ProfileDetailsProps {
  profile: Profile | null
  spaceCount: number
  sourceCount: number
}

function fieldValue(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '—'
}

export default function ProfileDetails({
  profile,
  spaceCount,
  sourceCount,
}: ProfileDetailsProps) {
  if (!profile) {
    return (
      <div className={styles.rcard}>
        <p className={styles.covempty}>Couldn’t load your profile details.</p>
      </div>
    )
  }

  const current = streakDays(profile)
  const longest = longestStreak(profile)
  const lastActive = formatProfileDate(profile.last_active_date)

  const fields: { label: string; value: string }[] = [
    { label: 'Full name', value: fieldValue(profile.full_name) },
    { label: 'Username', value: profile.username ? `@${profile.username}` : '—' },
    { label: 'Email', value: fieldValue(profile.email) },
    { label: 'Role', value: fieldValue(profile.primary_role) },
    { label: 'Domain of focus', value: fieldValue(profile.domain_of_focus) },
    { label: 'How you found exomemri', value: fieldValue(profile.referral_source) },
    { label: 'Profile updated', value: formatProfileDate(profile.updated_at) ?? '—' },
  ]

  const stats: { value: string; label: string; hint: string }[] = [
    {
      value: String(current),
      label: 'Current streak',
      hint: current === 1 ? 'day of consecutive activity' : 'days of consecutive activity',
    },
    {
      value: String(longest),
      label: 'Longest streak',
      hint: longest === 1 ? 'day, your best run' : 'days, your best run',
    },
    {
      value: lastActive ?? '—',
      label: 'Last active',
      hint: lastActive ? 'Most recent capture or study day' : 'No activity recorded yet',
    },
    {
      value: String(spaceCount),
      label: 'Learning Spaces',
      hint: spaceCount === 1 ? 'topic you are building' : 'topics you are building',
    },
    {
      value: String(sourceCount),
      label: 'Sources captured',
      hint: sourceCount === 1 ? 'saved across your spaces' : 'saved across your spaces',
    },
  ]

  return (
    <>
      <div className={styles.rcard}>
        <div className={styles.profileHero}>
          <div className={`${styles.avatar} ${styles.profileAvatar}`}>{initial(profile)}</div>
          <div>
            <div className={styles.profileName}>{profile.full_name || 'Your account'}</div>
            <div className={styles.profileHandle}>
              {profile.username ? `@${profile.username}` : 'No username yet'}
            </div>
          </div>
        </div>

        <dl className={styles.profileFields}>
          {fields.map(field => (
            <div key={field.label} className={styles.profileField}>
              <dt>{field.label}</dt>
              <dd className={field.value === '—' ? styles.profileMuted : undefined}>{field.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className={styles.profileStats}>
        {stats.map(stat => (
          <div className={styles.profileStat} key={stat.label}>
            <div className={styles.profileStatVal}>{stat.value}</div>
            <div className={styles.profileStatKey}>{stat.label}</div>
            <div className={styles.profileStatHint}>{stat.hint}</div>
          </div>
        ))}
      </div>
    </>
  )
}
