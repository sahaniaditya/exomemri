import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { atlasFontVars } from '@/lib/fonts'
import type { Profile } from '@/lib/profile'
import { getProfileVisibility } from '@/lib/public-profile'
import { listSpaces } from '@/lib/spaces'
import styles from '@/components/dashboard/dashboard.module.css'
import ContourBg from '@/components/dashboard/ContourBg'
import Plate from '@/components/dashboard/Plate'
import ProfileVisibilityToggle from '@/components/dashboard/ProfileVisibilityToggle'
import Sidebar from '@/components/dashboard/Sidebar'
import TopBar from '@/components/dashboard/TopBar'

export const metadata: Metadata = {
  title: 'Settings · exomemri',
  description: 'Account and sharing settings.',
}

async function loadProfile(token: string): Promise<Profile | null> {
  try {
    const res = await apiFetch('/v1/auth/me', {}, token)
    if (!res.ok) return null
    return (await res.json()) as Profile
  } catch (error) {
    console.error('Failed to load profile details:', error)
    return null
  }
}

export default async function SettingsPage() {
  const token = (await cookies()).get('atlas_token')?.value ?? ''

  const [profile, spaces, isPublic] = await Promise.all([
    loadProfile(token),
    listSpaces(token),
    getProfileVisibility(token),
  ])

  const totalSources = spaces.reduce((sum, space) => sum + space.source_counts.total, 0)

  return (
    <div className={`${styles.app} ${atlasFontVars}`}>
      <Sidebar spaceCount={spaces.length} sourceCount={totalSources} />
      <main className={styles.main}>
        <ContourBg />
        <div className={styles.inner}>
          <TopBar
            profile={profile}
            totalSources={totalSources}
            spaceCount={spaces.length}
            variant="compact"
          />

          <section id="sharing" className={styles.section}>
            <Plate num="01" title="Sharing" />
            <ProfileVisibilityToggle
              username={profile?.username ?? ''}
              initialPublic={isPublic}
            />
          </section>
        </div>
      </main>
    </div>
  )
}
