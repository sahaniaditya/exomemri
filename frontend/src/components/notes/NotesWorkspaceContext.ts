'use client'

import { createContext, useContext } from 'react'
import type { UseNoteTree } from './hooks/useNoteTree'

/**
 * Shared by the notes layout and the open page. The page calls
 * `tree.patchLocal(id, { title, icon })` after it saves so the sidebar stays
 * in step without a refetch, and `openSwitcher` / `openTrash` to reach the dialogs.
 */
export interface NotesWorkspaceValue {
  spaceId: string
  tree: UseNoteTree
  openSwitcher: () => void
  openTrash: () => void
}

export const NotesWorkspaceContext = createContext<NotesWorkspaceValue | null>(null)

export function useNotesWorkspace(): NotesWorkspaceValue | null {
  return useContext(NotesWorkspaceContext)
}
