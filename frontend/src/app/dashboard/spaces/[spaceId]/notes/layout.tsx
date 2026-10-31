import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import NotesWorkspace from '@/components/notes/NotesWorkspace'
import { loadNoteTree } from '@/lib/notes/server'

interface NotesLayoutProps {
  children: ReactNode
  params: Promise<{ spaceId: string }>
}

/** Page tree beside the open note. The tree is loaded here, once per visit. */
export default async function NotesLayout({ children, params }: NotesLayoutProps) {
  const { spaceId } = await params
  const token = (await cookies()).get('atlas_token')?.value ?? ''
  const { items, error } = await loadNoteTree(token, spaceId)

  return (
    <NotesWorkspace spaceId={spaceId} initialItems={items} loadFailed={error}>
      {children}
    </NotesWorkspace>
  )
}
