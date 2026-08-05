import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { apiFetch } from '@/lib/api'
import {
  getDashboardData,
  toCapturedSource,
  toLearningSpace,
} from '@/lib/dashboard-data'
import { atlasFontVars } from '@/lib/fonts'
import { firstName, type Profile } from '@/lib/profile'
import { listRecentSources, listSpaces } from '@/lib/spaces'

import styles from '@/components/dashboard/dashboard.module.css'
import AskBar from '@/components/dashboard/AskBar'
import CaptureFeed from '@/components/dashboard/CaptureFeed'
import ContourBg from '@/components/dashboard/ContourBg'
import GapsCard from '@/components/dashboard/GapsCard'
import Plate from '@/components/dashboard/Plate'
import ResumeCard from '@/components/dashboard/ResumeCard'
import ReviewCard from '@/components/dashboard/ReviewCard'
import Sidebar from '@/components/dashboard/Sidebar'
import SpacesGrid from '@/components/dashboard/SpacesGrid'
import StatsRow from '@/components/dashboard/StatsRow'
import TopBar from '@/components/dashboard/TopBar'
import WeekTimeline from '@/components/dashboard/WeekTimeline'

export const metadata: Metadata = {
  title: 'Overview · Atlas',
  description: 'Your learning memory at a glance.',
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

export default async function DashboardPage() {
  // The layout already gated auth/onboarding, so a token is expected here.
  const token = (await cookies()).get('atlas_token')?.value ?? ''

  const [profile, apiSpaces, recentSources] = await Promise.all([
    loadProfile(token),
    listSpaces(token),
    listRecentSources(token),
  ])

  const spaces = apiSpaces.map(toLearningSpace)
  const captures = recentSources.map(toCapturedSource)
  const data = getDashboardData({
    spaceCount: spaces.length,
    sourceCount: apiSpaces.reduce((sum, space) => sum + space.source_counts.total, 0),
  })

  return (
    <div className={`${styles.app} ${atlasFontVars}`}>
      <Sidebar
        profile={profile}
        spaceCount={spaces.length}
        reviewCount={data.review.total}
        totalSources={data.totalSources}
        plan={data.plan}
        extensionTabs={data.extensionTabs}
      />

      <main className={styles.main}>
        <ContourBg />

        <div className={styles.inner}>
          <TopBar
            name={firstName(profile)}
            dueCount={data.review.total}
            newConcepts={3}
            streakDays={data.streakDays}
          />

          <AskBar />

          <Plate num="01" title="Continue where you left off" />
          <ResumeCard item={data.resume} />

          <StatsRow stats={data.stats} />

          <Plate
            num="02"
            title="Your Learning Spaces"
            link={{ label: 'View all →', href: '/dashboard' }}
          />
          <SpacesGrid spaces={spaces} />

          <div className={styles.cols}>
            <div>
              <Plate num="03" title="Recently captured" />
              <CaptureFeed sources={captures} />
            </div>

            <div className={styles.rail}>
              <ReviewCard review={data.review} />
              <GapsCard gaps={data.gaps} />
            </div>
          </div>

          <div className={styles.tl}>
            <Plate
              num="05"
              title="This week’s learning"
              link={{ label: 'Full timeline →', href: '/dashboard' }}
            />
            <WeekTimeline days={data.week.days} deltaLabel={data.week.deltaLabel} />
          </div>
        </div>
      </main>
    </div>
  )
}
