'use client'

/**
 * Sidebar page tree: expand / collapse, add sub-page, inline rename, move
 * (drag and drop plus an accessible "Move to…" menu), duplicate and trash.
 * Data operations live in `useNoteTree`; this component only wires UI to them.
 */
import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { NO_ICON } from '@/lib/notes/constants'
import { loadExpanded, saveExpanded } from '@/lib/notes/storage'
import {
  canMove,
  computeReorder,
  dropPosition,
  moveTargets,
  type DropPosition,
  type TreeNode,
} from '@/lib/notes/tree'
import { notePath, type NoteTreeItem } from '@/lib/notes/types'
import type { UseNoteTree } from './hooks/useNoteTree'
import styles from './notes.module.css'

interface PageTreeProps {
  spaceId: string
  tree: UseNoteTree
  activeId: string | null
  /** Navigate to a page (used after creating one). */
  onOpen: (noteId: string) => void
  /** A page (or its parent) was trashed; `wasActive` = the open page is gone. */
  onTrashed?: (noteId: string, wasActive: boolean) => void
}

type MenuState = { id: string; mode: 'actions' | 'move' } | null
type DropHint = { id: string; position: DropPosition } | null

export default function PageTree({ spaceId, tree, activeId, onOpen, onTrashed }: PageTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<MenuState>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [hint, setHint] = useState<DropHint>(null)
  const loaded = useRef(false)

  // Persisted per space; read after mount so server and client markup match.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
    setExpanded(loadExpanded(spaceId))
    loaded.current = true
  }, [spaceId])

  const updateExpanded = useCallback(
    (mutate: (next: Set<string>) => void) => {
      setExpanded(prev => {
        const next = new Set(prev)
        mutate(next)
        if (loaded.current) saveExpanded(spaceId, next)
        return next
      })
    },
    [spaceId]
  )

  // Keep the open page visible: expand its parent.
  const activeParent = tree.items.find(item => item.id === activeId)?.parent_id ?? null
  useEffect(() => {
    if (activeParent) updateExpanded(next => next.add(activeParent))
  }, [activeParent, updateExpanded])

  useEffect(() => {
    if (!menu) return
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('[data-tree-menu]')) setMenu(null)
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const toggle = (id: string) =>
    updateExpanded(next => {
      if (!next.delete(id)) next.add(id)
    })

  const addChild = async (parentId: string | null) => {
    setMenu(null)
    const page = await tree.create(parentId)
    if (!page) return
    if (parentId) updateExpanded(next => next.add(parentId))
    onOpen(page.id)
  }

  const startRename = (item: NoteTreeItem) => {
    setMenu(null)
    setDraft(item.title)
    setRenaming(item.id)
  }

  const commitRename = async () => {
    const id = renaming
    setRenaming(null)
    if (id) await tree.rename(id, draft)
  }

  const onRenameKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void commitRename()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setRenaming(null)
    }
  }

  const trashItem = async (item: NoteTreeItem) => {
    setMenu(null)
    // The open page disappears if it is the trashed page or one of its children.
    const open = tree.items.find(i => i.id === activeId)
    const wasActive = item.id === activeId || open?.parent_id === item.id
    if (await tree.trash(item.id)) onTrashed?.(item.id, wasActive)
  }

  const duplicateItem = async (item: NoteTreeItem) => {
    setMenu(null)
    const page = await tree.duplicate(item.id)
    if (page) onOpen(page.id)
  }

  const moveItem = async (item: NoteTreeItem, parentId: string | null) => {
    setMenu(null)
    await tree.moveTo(item.id, parentId)
    if (parentId) updateExpanded(next => next.add(parentId))
  }

  // ---- drag and drop ------------------------------------------------
  const hintFor = (event: DragEvent<HTMLElement>, targetId: string): DropHint => {
    if (!dragId) return null
    const target = tree.items.find(item => item.id === targetId)
    if (!target) return null
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5
    const position = dropPosition(ratio, !target.parent_id)
    return computeReorder(tree.tree, dragId, targetId, position) === null
      ? null
      : { id: targetId, position }
  }

  const onDragOver = (event: DragEvent<HTMLElement>, targetId: string) => {
    const next = hintFor(event, targetId)
    if (!next) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setHint(prev => (prev?.id === next.id && prev.position === next.position ? prev : next))
  }

  const onDrop = async (event: DragEvent<HTMLElement>, targetId: string) => {
    const next = hintFor(event, targetId)
    event.preventDefault()
    const source = dragId
    setDragId(null)
    setHint(null)
    if (!next || !source) return
    const updates = computeReorder(tree.tree, source, targetId, next.position)
    if (updates?.length) {
      await tree.applyUpdates(updates)
      if (next.position === 'inside') updateExpanded(set => set.add(targetId))
    }
  }

  const renderRow = (item: NoteTreeItem, node: TreeNode | null) => {
    const isActive = item.id === activeId
    const isOpen = !!node && expanded.has(item.id)
    const hasChildren = !!node && node.children.length > 0
    const menuOpen = menu?.id === item.id
    const rowClass = [
      styles.row,
      isActive ? styles.rowActive : '',
      menuOpen ? styles.rowMenuOpen : '',
      dragId === item.id ? styles.rowDragging : '',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div
        className={rowClass}
        data-testid={`row-${item.id}`}
        data-drop={hint?.id === item.id ? hint.position : undefined}
        draggable={renaming !== item.id}
        onDragStart={event => {
          event.dataTransfer.setData('text/plain', item.id)
          event.dataTransfer.effectAllowed = 'move'
          setDragId(item.id)
        }}
        onDragEnd={() => {
          setDragId(null)
          setHint(null)
        }}
        onDragOver={event => onDragOver(event, item.id)}
        onDragLeave={() => setHint(prev => (prev?.id === item.id ? null : prev))}
        onDrop={event => void onDrop(event, item.id)}
      >
        {node ? (
          hasChildren ? (
            <button
              type="button"
              className={`${styles.caret} ${isOpen ? styles.caretOpen : ''}`}
              aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${item.title}`}
              aria-expanded={isOpen}
              onClick={() => toggle(item.id)}
            >
              ▶
            </button>
          ) : (
            <span className={styles.caretSpacer} />
          )
        ) : (
          <span className={styles.caretSpacer} />
        )}

        {renaming === item.id ? (
          <input
            className={styles.renameInput}
            aria-label={`Rename ${item.title}`}
            value={draft}
            maxLength={120}
            autoFocus
            onChange={event => setDraft(event.target.value)}
            onKeyDown={onRenameKey}
            onBlur={() => void commitRename()}
          />
        ) : (
          <Link
            href={notePath(spaceId, item.id)}
            className={styles.rowLink}
            aria-current={isActive ? 'page' : undefined}
            onDoubleClick={event => {
              event.preventDefault()
              startRename(item)
            }}
          >
            <span className={styles.rowIcon} aria-hidden="true">
              {item.icon || NO_ICON}
            </span>
            <span className={styles.rowTitle}>{item.title}</span>
          </Link>
        )}

        {node && (
          <button
            type="button"
            className={styles.rowBtn}
            aria-label={`Add sub-page to ${item.title}`}
            title="Add a sub-page"
            onClick={() => void addChild(item.id)}
          >
            +
          </button>
        )}
        <button
          type="button"
          className={styles.rowBtn}
          aria-label={`Actions for ${item.title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          data-tree-menu
          onClick={() => setMenu(menuOpen ? null : { id: item.id, mode: 'actions' })}
        >
          ⋯
        </button>

        {menuOpen && (
          <div className={styles.menu} role="menu" data-tree-menu>
            {menu?.mode === 'actions' ? (
              <>
                <button type="button" role="menuitem" className={styles.menuItem} onClick={() => startRename(item)}>
                  Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => setMenu({ id: item.id, mode: 'move' })}
                >
                  Move to…
                </button>
                <button type="button" role="menuitem" className={styles.menuItem} onClick={() => void duplicateItem(item)}>
                  Duplicate
                </button>
                <button type="button" role="menuitem" className={styles.menuItemDanger} onClick={() => void trashItem(item)}>
                  Move to trash
                </button>
              </>
            ) : (
              <>
                <div className={styles.menuLabel}>Move to</div>
                {item.parent_id && canMove(tree.tree, item.id, null) && (
                  <button type="button" role="menuitem" className={styles.menuItem} onClick={() => void moveItem(item, null)}>
                    Top level
                  </button>
                )}
                {moveTargets(tree.tree, item.id)
                  .filter(target => target.id !== item.parent_id)
                  .map(target => (
                    <button
                      key={target.id}
                      type="button"
                      role="menuitem"
                      className={styles.menuItem}
                      onClick={() => void moveItem(item, target.id)}
                    >
                      {(target.icon || NO_ICON) + ' ' + target.title}
                    </button>
                  ))}
                {!item.parent_id && moveTargets(tree.tree, item.id).length === 0 && (
                  <div className={styles.menuLabel}>
                    {node && node.children.length > 0
                      ? 'Pages with sub-pages stay at the top level'
                      : 'No other pages'}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <nav aria-label="Pages">
      {tree.error && (
        <div className={styles.treeError} role="alert">
          {tree.error}{' '}
          <button type="button" className={styles.btnGhost} onClick={tree.clearError}>
            Dismiss
          </button>
        </div>
      )}
      {tree.tree.length === 0 ? (
        <p className={styles.treeEmpty}>No pages yet. Create your first page below.</p>
      ) : (
        <ul className={styles.treeList} role="tree">
          {tree.tree.map(root => (
            <li key={root.id} className={styles.treeItem} role="treeitem" aria-selected={root.id === activeId} aria-expanded={root.children.length ? expanded.has(root.id) : undefined}>
              {renderRow(root, root)}
              {root.children.length > 0 && expanded.has(root.id) && (
                <ul className={styles.treeChildren} role="group">
                  {root.children.map(child => (
                    <li key={child.id} className={styles.treeItem} role="treeitem" aria-selected={child.id === activeId}>
                      {renderRow(child, null)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className={styles.footerBtn} onClick={() => void addChild(null)}>
        <span aria-hidden="true">＋</span> New page
      </button>
    </nav>
  )
}
