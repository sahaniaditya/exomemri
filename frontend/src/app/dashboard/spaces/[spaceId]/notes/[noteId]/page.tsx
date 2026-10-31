import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { atlasFontVars } from '@/lib/fonts'
import { loadNotePage } from '@/lib/notes/server'
import { listSpaces } from '@/lib/spaces'
import NoteCanvas from '@/components/notes/NoteCanvas'

export const metadata: Metadata = {
  title: 'Note · exomemri',
  description: 'A page in your learning space notes.',
}

interface NotePageProps {
  params: Promise<{ spaceId: string; noteId: string }>
}

export default async function SpaceNotePage({ params }: NotePageProps) {
  const { spaceId, noteId } = await params
  const token = (await cookies()).get('atlas_token')?.value ?? ''

  const [spaces, note] = await Promise.all([
    listSpaces(token),
    loadNotePage(token, spaceId, noteId),
  ])

  const space = spaces.find(item => item.id === spaceId)
  if (!space) notFound()

  if (!note) notFound()

  return (
    <div className={atlasFontVars}>
      <NoteCanvas key={note.id} spaceId={spaceId} spaceName={space.name} note={note} />
    </div>
  )
}
