import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { atlasFontVars } from '@/lib/fonts'
import { getPublicProfile } from '@/lib/public-profile'
import dashboardStyles from '@/components/dashboard/dashboard.module.css'
import CoverageRing from '@/components/dashboard/CoverageRing'
import styles from './public-profile.module.css'

interface PublicProfilePageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { username } = await params
  return {
    title: `${username} · exomemri`,
    description: 'A public Atlas learning profile.',
  }
}

// Deliberately no cookies()/token read anywhere on this page — it renders
// the same for every visitor, logged in or not. Access is gated entirely by
// the backend's opt-in profile_public flag, not by anything client-side.
export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params
  const profile = await getPublicProfile(username)
  if (!profile) notFound()

  const totalSources = profile.spaces.reduce((sum, space) => sum + space.source_count, 0)

  return (
    <div className={`${styles.page} ${atlasFontVars}`}>
      <h1>{profile.full_name}</h1>
      <p className={dashboardStyles.covempty}>@{profile.username}</p>

      <div className={styles.chips}>
        <span className={dashboardStyles.covchip}>{totalSources} sources captured</span>
        <span className={dashboardStyles.covchip}>{profile.current_streak}-day streak</span>
        <span className={dashboardStyles.covchip}>{profile.spaces.length} Learning Spaces</span>
      </div>

      <div className={styles.grid}>
        {profile.spaces.map(space => (
          <div key={space.name} className={dashboardStyles.rcard}>
            <div className={dashboardStyles.covhead}>
              <h4>{space.name}</h4>
              {space.coverage_pct !== null && <CoverageRing pct={space.coverage_pct} />}
            </div>
            <p className={dashboardStyles.covempty}>
              {space.source_count} {space.source_count === 1 ? 'source' : 'sources'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
