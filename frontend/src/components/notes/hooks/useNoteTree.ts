'use client'

/**
 * Client state for the page tree: optimistic edits backed by the BFF, with a
 * refetch to heal the list whenever a write fails.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createPage,
  duplicatePage,
  fetchTree,
  patchPage,
  trashPage,
} from '@/lib/notes/client'
import {
  applyReorder,
  buildTree,
  computeReorder,
  type ReorderUpdate,
  type TreeNode,
} from '@/lib/notes/tree'
import type { NoteTreeItem, WorkspacePage } from '@/lib/notes/types'
import { DEFAULT_TITLE } from '@/lib/notes/constants'

export interface UseNoteTree {
  items: NoteTreeItem[]
  tree: TreeNode[]
  error: string | null
  clearError: () => void
  refresh: () => Promise<void>
  create: (parentId?: string | null) => Promise<WorkspacePage | null>
  rename: (id: string, title: string) => Promise<void>
  moveTo: (id: string, parentId: string | null) => Promise<void>
  applyUpdates: (updates: ReorderUpdate[]) => Promise<void>
  duplicate: (id: string) => Promise<WorkspacePage | null>
  trash: (id: string) => Promise<boolean>
  /** Reflect an edit made elsewhere (e.g. the page header) without a request. */
  patchLocal: (id: string, patch: Partial<NoteTreeItem>) => void
}

const toItem = (page: WorkspacePage): NoteTreeItem => ({
  id: page.id,
  title: page.title,
  icon: page.icon,
  parent_id: page.parent_id,
  sort_order: page.sort_order,
  updated_at: page.updated_at,
})

const messageOf = (caught: unknown, fallback: string) =>
  caught instanceof Error && caught.message ? caught.message : fallback

export function useNoteTree(
  spaceId: string,
  initialItems: NoteTreeItem[],
  initialError: string | null = null
): UseNoteTree {
  const [items, setItems] = useState(initialItems)
  const [error, setError] = useState<string | null>(initialError)
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const tree = useMemo(() => buildTree(items), [items])

  const refresh = useCallback(async () => {
    try {
      setItems(await fetchTree(spaceId))
    } catch (caught) {
      setError(messageOf(caught, 'Could not refresh pages.'))
    }
  }, [spaceId])

  const fail = useCallback(
    async (caught: unknown, fallback: string) => {
      setError(messageOf(caught, fallback))
      await refresh()
    },
    [refresh]
  )

  const create = useCallback(
    async (parentId: string | null = null) => {
      try {
        const page = await createPage(spaceId, { title: DEFAULT_TITLE, parent_id: parentId })
        setItems(prev => [...prev, toItem(page)])
        return page
      } catch (caught) {
        setError(messageOf(caught, 'Could not create the page.'))
        return null
      }
    },
    [spaceId]
  )

  const patchLocal = useCallback((id: string, patch: Partial<NoteTreeItem>) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const rename = useCallback(
    async (id: string, title: string) => {
      const next = title.trim()
      const current = itemsRef.current.find(item => item.id === id)
      if (!current || !next || next === current.title) return
      patchLocal(id, { title: next })
      try {
        const page = await patchPage(spaceId, id, { title: next })
        patchLocal(id, { title: page.title, updated_at: page.updated_at })
      } catch (caught) {
        await fail(caught, 'Could not rename the page.')
      }
    },
    [spaceId, patchLocal, fail]
  )

  const applyUpdates = useCallback(
    async (updates: ReorderUpdate[]) => {
      if (updates.length === 0) return
      setItems(prev => applyReorder(prev, updates))
      try {
        // Sequential: the first update is the moved page, which the backend validates.
        for (const update of updates) {
          await patchPage(spaceId, update.id, {
            parent_id: update.parent_id,
            sort_order: update.sort_order,
          })
        }
      } catch (caught) {
        await fail(caught, 'Could not move the page.')
      }
    },
    [spaceId, fail]
  )

  const moveTo = useCallback(
    async (id: string, parentId: string | null) => {
      const roots = buildTree(itemsRef.current)
      let updates: ReorderUpdate[] | null
      if (parentId) {
        updates = computeReorder(roots, id, parentId, 'inside')
      } else {
        const last = [...roots].reverse().find(root => root.id !== id)
        updates = last
          ? computeReorder(roots, id, last.id, 'after')
          : []
      }
      if (updates === null) {
        setError('That page cannot be moved there.')
        return
      }
      await applyUpdates(updates)
    },
    [applyUpdates]
  )

  const duplicate = useCallback(
    async (id: string) => {
      try {
        const page = await duplicatePage(spaceId, id)
        setItems(prev => [...prev, toItem(page)])
        return page
      } catch (caught) {
        setError(messageOf(caught, 'Could not duplicate the page.'))
        return null
      }
    },
    [spaceId]
  )

  const trash = useCallback(
    async (id: string) => {
      const before = itemsRef.current
      setItems(prev => prev.filter(item => item.id !== id && item.parent_id !== id))
      try {
        await trashPage(spaceId, id)
        return true
      } catch (caught) {
        setItems(before)
        setError(messageOf(caught, 'Could not move the page to the trash.'))
        return false
      }
    },
    [spaceId]
  )

  return {
    items,
    tree,
    error,
    clearError: () => setError(null),
    refresh,
    create,
    rename,
    moveTo,
    applyUpdates,
    duplicate,
    trash,
    patchLocal,
  }
}
