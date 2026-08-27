import Link from 'next/link'
import ContourBg from '@/components/dashboard/ContourBg'
import Plate from '@/components/dashboard/Plate'
import dashboardStyles from '@/components/dashboard/dashboard.module.css'
import { atlasFontVars } from '@/lib/fonts'
import type { PublicProfile } from '@/lib/public-profile'
import ProfileIdentity from './ProfileIdentity'
import PublicSpacesList from './PublicSpacesList'
import styles from './public-profile.module.css'

/** Public portfolio composition for `/u/[username]`. */
export default function PublicProfileView({ profile }: { profile: PublicProfile }) {
  const totalSources = profile.spaces.reduce((sum, space) => sum + space.source_count, 0)
  const firstName = profile.full_name.split(' ')[0] || profile.full_name

  return (
    <div className={`${dashboardStyles.app} ${styles.shell} ${atlasFontVars}`}>
      {/* dashboardStyles.main hosts ContourBg — keep both so the wavy paper
          backdrop stays behind the profile card. */}
      <main className={`${dashboardStyles.main} ${styles.main}`}>
        <ContourBg />
        <div className={styles.inner}>
          <ProfileIdentity
            fullName={profile.full_name}
            username={profile.username}
            currentStreak={profile.current_streak}
            totalSources={totalSources}
            spaceCount={profile.spaces.length}
          />

          <section className={styles.spacesSection}>
            <Plate num="01" title="Learning Spaces" />
            {profile.spaces.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>No public spaces yet</p>
                <p className={styles.emptyBody}>
                  {firstName} hasn&apos;t shared any Learning Spaces.
                </p>
              </div>
            ) : (
              <PublicSpacesList spaces={profile.spaces} />
            )}
          </section>

          <footer className={styles.footer}>
            <p className={styles.footerCopy}>
              <Link href="/" className={styles.footerBrand}>
                exomemri
              </Link>
              {' · '}
              Capture what you learn.
            </p>
            <Link href="/signup" className={styles.footerCta}>
              Start free →
            </Link>
          </footer>
        </div>
      </main>
    </div>
  )
}
