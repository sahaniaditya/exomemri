import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { atlasFontVars } from '@/lib/fonts'
import { listSpaceSources, listSpaces } from '@/lib/spaces'
import { getSourceSummary, listSourceMessages } from '@/lib/sources'
import { getSourceNote } from '@/lib/notes'
import styles from '@/components/dashboard/dashboard.module.css'
import ContourBg from '@/components/dashboard/ContourBg'
import SourceDetail from '@/components/dashboard/SourceDetail'
import SourceSidebar from '@/components/dashboard/SourceSidebar'

export const metadata: Metadata = {
  title: 'Source · exomemri',
}

interface SourcePageProps {
  params: Promise<{ spaceId: string; sourceId: string }>
}

export default async function SourcePage({ params }: SourcePageProps) {
  const { spaceId, sourceId } = await params
  const token = (await cookies()).get('atlas_token')?.value ?? ''

  const [spaces, sourcesInSpace] = await Promise.all([
    listSpaces(token),
    listSpaceSources(token, spaceId),
  ])

  const activeSpace = spaces.find(s => s.id === spaceId)
  const activeSource = sourcesInSpace.find(s => s.id === sourceId)
  if (!activeSpace || !activeSource) notFound()

  const [summary, messages, note] = await Promise.all([
    getSourceSummary(token, sourceId),
    listSourceMessages(token, sourceId),
    getSourceNote(token, sourceId),
  ])

  return (
    <div className={`${styles.app} ${styles.appSource} ${atlasFontVars}`}>
      <SourceSidebar space={activeSpace} sources={sourcesInSpace} activeSourceId={sourceId} />
      <main className={styles.main}>
        <ContourBg />
        <div className={styles.captureInner}>
          <SourceDetail
            source={activeSource}
            spaceName={activeSpace.name}
            initialSummary={summary}
            initialMessages={messages}
            initialNote={note}
          />
        </div>
      </main>
    </div>
  )
}
