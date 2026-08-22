import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { atlasFontVars } from '@/lib/fonts'
import { getReviewQueue } from '@/lib/review'
import { listSpaces } from '@/lib/spaces'
import styles from '@/components/dashboard/dashboard.module.css'
import ContourBg from '@/components/dashboard/ContourBg'
import Plate from '@/components/dashboard/Plate'
import ReviewSession from '@/components/dashboard/ReviewSession'
import SpacesSidebar from '@/components/dashboard/SpacesSideBar'

export const metadata: Metadata = {
  title: 'Review · exomemri',
  description: "Today's study queue for this Learning Space.",
}

interface SpaceReviewPageProps {
  params: Promise<{ spaceId: string }>
}

export default async function SpaceReviewPage({ params }: SpaceReviewPageProps) {
  const { spaceId } = await params
  const token = (await cookies()).get('atlas_token')?.value ?? ''

  const [spaces, queue] = await Promise.all([listSpaces(token), getReviewQueue(token, spaceId)])

  const activeSpace = spaces.find(space => space.id === spaceId)
  if (!activeSpace) notFound()

  return (
    <div className={`${styles.app} ${atlasFontVars}`}>
      <SpacesSidebar spaces={spaces} activeSpaceId={spaceId} />
      <main className={styles.main}>
        <ContourBg />
        <div className={styles.inner}>
          <section id="review" className={styles.section}>
            <Plate num="01" title={`Study today · ${activeSpace.name}`} />
            <ReviewSession spaceId={spaceId} initialItems={queue.items} />
          </section>
        </div>
      </main>
    </div>
  )
}
