'use client'

/**
 * Space-scoped capture list grouped into one-level folders.
 * Owners can create / rename / delete folders and move captures;
 * viewers see the same grouping read-only.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

import {
  isCaptureProcessing,
  type CapturedSource,
} from '@/lib/dashboard-data'
import type { SpaceFolder } from '@/lib/spaces'
import CaptureFeed, { CaptureRow } from './CaptureFeed'
import MoveToFolderMenu from './MoveToFolderMenu'
import styles from './dashboard.module.css'

const POLL_MS = 2500

export default function SpaceCaptureFeed({
  spaceId,
  sources,
  folders,
  canEdit,
  emptyTitle,
  emptyBody,
}: {
  spaceId: string
  sources: CapturedSource[]
  folders: SpaceFolder[]
  canEdit: boolean
  emptyTitle: string
  emptyBody: string
}) {
  const router = useRouter()
  const pending = sources.some(source => isCaptureProcessing(source.status))
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [busyFolder, setBusyFolder] = useState<string | null>(null)

  useEffect(() => {
    if (!pending) return
    const id = window.setInterval(() => {
      router.refresh()
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [pending, router])

  const grouped = useMemo(() => {
    const byFolder = new Map<string, CapturedSource[]>()
    for (const folder of folders) byFolder.set(folder.id, [])
    const ungrouped: CapturedSource[] = []
    for (const source of sources) {
      if (source.folderId && byFolder.has(source.folderId)) {
        byFolder.get(source.folderId)!.push(source)
      } else {
        ungrouped.push(source)
      }
    }
    return { ungrouped, byFolder }
  }, [folders, sources])

  function toggle(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startRename(folder: SpaceFolder) {
    setRenamingId(folder.id)
    setRenameValue(folder.name)
    setRenameError(null)
  }

  async function submitRename(folderId: string) {
    const trimmed = renameValue.trim()
    if (trimmed.length < 2) {
      setRenameError('Use at least 2 characters.')
      return
    }
    setBusyFolder(folderId)
    setRenameError(null)
    try {
      const res = await fetch(`/api/spaces/${spaceId}/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (res.status === 409) {
        setRenameError('A folder with that name already exists.')
        return
      }
      if (res.status === 401) {
        setRenameError('Your session has expired. Please log in again.')
        return
      }
      if (!res.ok) {
        setRenameError('Could not rename the folder. Please try again.')
        return
      }
      setRenamingId(null)
      router.refresh()
    } catch {
      setRenameError('Could not reach the server. Please try again.')
    } finally {
      setBusyFolder(null)
    }
  }

  async function removeFolder(folder: SpaceFolder) {
    const ok = window.confirm(
      `Delete “${folder.name}”? Captures inside it return to Ungrouped — they are not deleted.`
    )
    if (!ok) return
    setBusyFolder(folder.id)
    try {
      const res = await fetch(`/api/spaces/${spaceId}/folders/${folder.id}`, {
        method: 'DELETE',
      })
      if (!res.ok && res.status !== 204) {
        window.alert('Could not delete the folder. Please try again.')
        return
      }
      router.refresh()
    } catch {
      window.alert('Could not reach the server. Please try again.')
    } finally {
      setBusyFolder(null)
    }
  }

  function rowActions(source: CapturedSource) {
    if (!canEdit) return null
    return (
      <MoveToFolderMenu
        spaceId={spaceId}
        sourceId={source.id}
        currentFolderId={source.folderId}
        folders={folders}
      />
    )
  }

  if (sources.length === 0 && folders.length === 0) {
    return (
      <CaptureFeed
        sources={sources}
        emptyTitle={emptyTitle}
        emptyBody={emptyBody}
      />
    )
  }

  const showUngrouped = grouped.ungrouped.length > 0 || folders.length === 0

  return (
    <div className={styles.folderStack}>
      {showUngrouped && (
        <FolderGroup
          id="ungrouped"
          title="Ungrouped"
          count={grouped.ungrouped.length}
          collapsed={collapsed.has('ungrouped')}
          onToggle={() => toggle('ungrouped')}
        >
          {grouped.ungrouped.length === 0 ? (
            <div className={styles.folderEmpty}>Nothing ungrouped.</div>
          ) : (
            grouped.ungrouped.map(source => (
              <CaptureRow
                key={source.id}
                source={source}
                extraActions={rowActions(source)}
              />
            ))
          )}
        </FolderGroup>
      )}

      {folders.map(folder => {
        const items = grouped.byFolder.get(folder.id) ?? []
        const isOpen = !collapsed.has(folder.id)
        return (
          <FolderGroup
            key={folder.id}
            id={folder.id}
            title={folder.name}
            count={items.length}
            collapsed={!isOpen}
            onToggle={() => toggle(folder.id)}
            editing={renamingId === folder.id}
            renameValue={renameValue}
            renameError={renameError}
            onRenameValue={setRenameValue}
            onSubmitRename={() => void submitRename(folder.id)}
            onCancelRename={() => setRenamingId(null)}
            actions={
              canEdit ? (
                <>
                  <button
                    type="button"
                    className={styles.folderAction}
                    disabled={busyFolder === folder.id}
                    onClick={() => startRename(folder)}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className={styles.folderAction}
                    disabled={busyFolder === folder.id}
                    onClick={() => void removeFolder(folder)}
                  >
                    Delete
                  </button>
                </>
              ) : null
            }
          >
            {items.length === 0 ? (
              <div className={styles.folderEmpty}>
                Empty — move a capture here from Ungrouped.
              </div>
            ) : (
              items.map(source => (
                <CaptureRow
                  key={source.id}
                  source={source}
                  extraActions={rowActions(source)}
                />
              ))
            )}
          </FolderGroup>
        )
      })}
    </div>
  )
}

function FolderGroup({
  id,
  title,
  count,
  collapsed,
  onToggle,
  children,
  actions,
  editing,
  renameValue,
  renameError,
  onRenameValue,
  onSubmitRename,
  onCancelRename,
}: {
  id: string
  title: string
  count: number
  collapsed: boolean
  onToggle: () => void
  children: ReactNode
  actions?: ReactNode
  editing?: boolean
  renameValue?: string
  renameError?: string | null
  onRenameValue?: (value: string) => void
  onSubmitRename?: () => void
  onCancelRename?: () => void
}) {
  return (
    <div className={styles.folderGroup}>
      <div className={styles.folderHead}>
        <button
          type="button"
          className={styles.folderToggle}
          aria-expanded={!collapsed}
          aria-controls={`folder-body-${id}`}
          onClick={onToggle}
        >
          <span className={styles.folderChevron} aria-hidden="true">
            {collapsed ? '▸' : '▾'}
          </span>
          {editing ? (
            <span
              className={styles.folderRename}
              onClick={event => event.stopPropagation()}
              onKeyDown={event => event.stopPropagation()}
            >
              <input
                className={styles.folderRenameInput}
                value={renameValue}
                onChange={event => onRenameValue?.(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    onSubmitRename?.()
                  }
                  if (event.key === 'Escape') onCancelRename?.()
                }}
                aria-label="Folder name"
                autoFocus
              />
              <button
                type="button"
                className={styles.folderAction}
                onClick={onSubmitRename}
              >
                Save
              </button>
              <button
                type="button"
                className={styles.folderAction}
                onClick={onCancelRename}
              >
                Cancel
              </button>
            </span>
          ) : (
            <span className={styles.folderTitle}>{title}</span>
          )}
          <span className={styles.folderCount}>
            {count} {count === 1 ? 'item' : 'items'}
          </span>
        </button>
        {actions && !editing ? (
          <div className={styles.folderActions}>{actions}</div>
        ) : null}
      </div>
      {renameError && editing ? (
        <div className={styles.folderError}>{renameError}</div>
      ) : null}
      {!collapsed && (
        <div id={`folder-body-${id}`} className={styles.folderBody}>
          {children}
        </div>
      )}
    </div>
  )
}
