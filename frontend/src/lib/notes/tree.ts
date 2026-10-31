/**
 * Pure page-tree logic. The tree is one level deep: root pages and their
 * children; a child can never have children (enforced by the backend too).
 */
import type { NoteTreeItem } from './types'

export interface TreeNode extends NoteTreeItem {
  children: NoteTreeItem[]
}

export type DropPosition = 'before' | 'after' | 'inside'

export interface ReorderUpdate {
  id: string
  parent_id: string | null
  sort_order: number
}

const bySort = (a: NoteTreeItem, b: NoteTreeItem) =>
  a.sort_order - b.sort_order || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)

/** Group a flat list into roots with children. Orphans are promoted to roots. */
export function buildTree(items: NoteTreeItem[]): TreeNode[] {
  const ids = new Set(items.map(item => item.id))
  const isRoot = (item: NoteTreeItem) => !item.parent_id || !ids.has(item.parent_id)
  const childrenOf = new Map<string, NoteTreeItem[]>()
  for (const item of items) {
    if (isRoot(item)) continue
    const list = childrenOf.get(item.parent_id as string) ?? []
    list.push(item)
    childrenOf.set(item.parent_id as string, list)
  }
  return items
    .filter(isRoot)
    .sort(bySort)
    .map(root => ({
      ...root,
      parent_id: null,
      children: (childrenOf.get(root.id) ?? []).sort(bySort),
    }))
}

function findNode(tree: TreeNode[], id: string): NoteTreeItem | null {
  for (const root of tree) {
    if (root.id === id) return root
    const child = root.children.find(c => c.id === id)
    if (child) return child
  }
  return null
}

/** Can page `id` be placed under `newParentId` (null = top level)? */
export function canMove(tree: TreeNode[], id: string, newParentId: string | null): boolean {
  if (!findNode(tree, id)) return false
  if (newParentId === null) return true
  if (newParentId === id) return false
  const parent = tree.find(root => root.id === newParentId)
  if (!parent) return false // missing, or itself a child (depth limit)
  const own = tree.find(root => root.id === id)
  return !own || own.children.length === 0
}

/** Root pages that `id` could be moved under (for the "Move to…" menu). */
export function moveTargets(tree: TreeNode[], id: string): NoteTreeItem[] {
  return tree.filter(root => root.id !== id && canMove(tree, id, root.id))
}

/** Decide where a drop lands from the pointer position inside the target row. */
export function dropPosition(ratio: number, allowInside: boolean): DropPosition {
  if (allowInside) {
    if (ratio < 0.25) return 'before'
    if (ratio > 0.75) return 'after'
    return 'inside'
  }
  return ratio < 0.5 ? 'before' : 'after'
}

function rootsAsItems(tree: TreeNode[]): NoteTreeItem[] {
  return tree.map(root => {
    const { children, ...rest } = root
    void children
    return rest
  })
}

/**
 * Updates needed to drop `dragId` before/after/inside `targetId`.
 * `null` = not allowed; `[]` = nothing would change. The dragged page is
 * always first so the backend validates the move before siblings renumber.
 */
export function computeReorder(
  tree: TreeNode[],
  dragId: string,
  targetId: string,
  position: DropPosition
): ReorderUpdate[] | null {
  if (dragId === targetId) return null
  const dragged = findNode(tree, dragId)
  const target = findNode(tree, targetId)
  if (!dragged || !target) return null

  if (position === 'inside' && target.parent_id) return null
  const newParent = position === 'inside' ? targetId : (target.parent_id ?? null)
  if (!canMove(tree, dragId, newParent)) return null

  const siblingPool =
    newParent === null ? rootsAsItems(tree) : (tree.find(r => r.id === newParent)?.children ?? [])
  const siblings = siblingPool.filter(item => item.id !== dragId)
  let index = siblings.length
  if (position !== 'inside') {
    const at = siblings.findIndex(item => item.id === targetId)
    index = position === 'before' ? at : at + 1
  }
  const ordered = [...siblings.slice(0, index), dragged, ...siblings.slice(index)]

  const updates: ReorderUpdate[] = []
  ordered.forEach((item, order) => {
    const isDragged = item.id === dragId
    const changed =
      item.sort_order !== order || (isDragged && (item.parent_id ?? null) !== newParent)
    if (changed) {
      updates.push({
        id: item.id,
        parent_id: isDragged ? newParent : (item.parent_id ?? null),
        sort_order: order,
      })
    }
  })
  return updates.sort((a, b) => Number(b.id === dragId) - Number(a.id === dragId))
}

/** Apply updates to a flat list (optimistic UI). */
export function applyReorder(items: NoteTreeItem[], updates: ReorderUpdate[]): NoteTreeItem[] {
  const byId = new Map(updates.map(u => [u.id, u]))
  return items.map(item => {
    const u = byId.get(item.id)
    return u ? { ...item, parent_id: u.parent_id, sort_order: u.sort_order } : item
  })
}
