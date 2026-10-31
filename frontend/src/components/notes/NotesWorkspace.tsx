'use client'

/**
 * Client shell of the notes area: page-tree sidebar (a drawer on mobile),
 * Ctrl/Cmd+K switcher and the trash dialog around the open page.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { recordRecent } from '@/lib/notes/storage'
import { notePath, type NoteTreeItem } from '@/lib/notes/types'
import { useNoteTree } from './hooks/useNoteTree'
import { NotesWorkspaceContext } from './NotesWorkspaceContext'
import PageTree from './PageTree'
import QuickSwitcher from './QuickSwitcher'
import TrashDialog from './TrashDialog'
import styles from './notes.module.css'

interface NotesWorkspaceProps {
  spaceId: string
  initialItems: NoteTreeItem[]
  /** The server could not load the tree; show a message instead of "no pages". */
  loadFailed?: boolean
  children: ReactNode
}

export default function NotesWorkspace({
  spaceId,
  initialItems,
  loadFailed = false,
  children,
}: NotesWorkspaceProps) {
  const router = useRouter()
  const params = useParams<{ noteId?: string }>()
  const activeId = typeof params?.noteId === 'string' ? params.noteId : null
  const tree = useNoteTree(
    spaceId,
    initialItems,
    loadFailed ? 'Could not load your pages. Try refreshing.' : null
  )
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { refresh } = tree
  const openPage = useCallback(
    (noteId: string) => {
      setDrawerOpen(false)
      router.push(notePath(spaceId, noteId))
    },
    [router, spaceId]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSwitcherOpen(open => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Remember visited pages for the switcher's empty state.
  const active = tree.items.find(item => item.id === activeId)
  const activeTitle = active?.title
  const activeIcon = active?.icon ?? null
  useEffect(() => {
    if (activeId && activeTitle) {
      recordRecent(spaceId, { id: activeId, title: activeTitle, icon: activeIcon })
    }
  }, [spaceId, activeId, activeTitle, activeIcon])

  const value = useMemo(
    () => ({
      spaceId,
      tree,
      openSwitcher: () => setSwitcherOpen(true),
      openTrash: () => setTrashOpen(true),
    }),
    [spaceId, tree]
  )

  return (
    <NotesWorkspaceContext.Provider value={value}>
      <div className={styles.workspace}>
        <button
          type="button"
          className={styles.drawerToggle}
          aria-label="Open pages"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          ☰ Pages
        </button>
        {drawerOpen && (
          <div
            className={styles.drawerBackdrop}
            data-testid="drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
          />
        )}
        <aside
          className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ''}`}
          aria-label="Notes sidebar"
        >
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>Pages</span>
          </div>
          <PageTree
            spaceId={spaceId}
            tree={tree}
            activeId={activeId}
            onOpen={openPage}
            onTrashed={(_id, wasActive) => {
              if (wasActive) router.push(`/dashboard/spaces/${spaceId}`)
            }}
          />
          <div className={styles.sidebarFooter}>
            <button type="button" className={styles.footerBtn} onClick={() => setSwitcherOpen(true)}>
              <span aria-hidden="true">🔍</span> Search
              <span className={styles.kbd}>Ctrl K</span>
            </button>
            <button type="button" className={styles.footerBtn} onClick={() => setTrashOpen(true)}>
              <span aria-hidden="true">🗑️</span> Trash
            </button>
          </div>
        </aside>
        <div className={styles.main}>{children}</div>
      </div>

      <QuickSwitcher
        spaceId={spaceId}
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        onSelect={openPage}
      />
      <TrashDialog
        spaceId={spaceId}
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        onRestored={() => void refresh()}
      />
    </NotesWorkspaceContext.Provider>
  )
}
