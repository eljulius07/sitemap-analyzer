import { create } from 'zustand'
import type { UrlResult } from '@shared/types'
import { buildTree, flatten, searchTree, type ColorMode, type TreeNode } from '../components/graph/treeUtils'

export type TreeLayout = 'tree-vertical' | 'tree-horizontal' | 'radial'

interface TreeStore {
  layoutMode: TreeLayout
  colorMode: ColorMode
  tree: TreeNode | null
  expandedNodes: Set<string>
  selectedNodeId: string | null
  hoveredNodeId: string | null
  searchQuery: string
  searchResults: string[]
  showLinkGraph: boolean
  fitSignal: number
  zoomSignal: { id: string; n: number } | null

  setLayout: (m: TreeLayout) => void
  setColorMode: (m: ColorMode) => void
  buildFromResults: (results: UrlResult[], startUrl: string) => void
  toggleExpand: (id: string) => void
  expandSubtree: (id: string) => void
  collapseSubtree: (id: string) => void
  expandAll: () => void
  collapseAll: () => void
  expandToDepth: (depth: number) => void
  selectNode: (id: string | null) => void
  hoverNode: (id: string | null) => void
  search: (q: string) => void
  fit: () => void
  zoomToNode: (id: string) => void
  setShowLinkGraph: (v: boolean) => void
}

function descendantIds(node: TreeNode): string[] {
  return flatten(node)
    .filter((n) => n !== node)
    .map((n) => n.id)
}

export const useTreeStore = create<TreeStore>((set, get) => ({
  layoutMode: 'tree-vertical',
  colorMode: 'health',
  tree: null,
  expandedNodes: new Set(),
  selectedNodeId: null,
  hoveredNodeId: null,
  searchQuery: '',
  searchResults: [],
  showLinkGraph: false,
  fitSignal: 0,
  zoomSignal: null,

  setLayout: (layoutMode) => set({ layoutMode, fitSignal: get().fitSignal + 1 }),
  setColorMode: (colorMode) => set({ colorMode }),

  buildFromResults: (results, startUrl) => {
    const tree = buildTree(results, startUrl)
    const expanded = new Set<string>(flatten(tree).filter((n) => n.depth < 2).map((n) => n.id))
    set({ tree, expandedNodes: expanded, selectedNodeId: null, searchQuery: '', searchResults: [], fitSignal: get().fitSignal + 1 })
  },

  toggleExpand: (id) => {
    const next = new Set(get().expandedNodes)
    next.has(id) ? next.delete(id) : next.add(id)
    set({ expandedNodes: next })
  },

  expandSubtree: (id) => {
    const { tree } = get()
    if (!tree) return
    const node = flatten(tree).find((n) => n.id === id)
    if (!node) return
    const next = new Set(get().expandedNodes)
    next.add(id)
    for (const d of descendantIds(node)) next.add(d)
    set({ expandedNodes: next })
  },

  collapseSubtree: (id) => {
    const { tree } = get()
    if (!tree) return
    const node = flatten(tree).find((n) => n.id === id)
    if (!node) return
    const next = new Set(get().expandedNodes)
    for (const d of descendantIds(node)) next.delete(d)
    next.delete(id)
    set({ expandedNodes: next })
  },

  expandAll: () => {
    const { tree } = get()
    if (!tree) return
    set({ expandedNodes: new Set(flatten(tree).map((n) => n.id)) })
  },

  collapseAll: () => {
    const { tree } = get()
    if (!tree) return
    set({ expandedNodes: new Set([tree.id]) })
  },

  expandToDepth: (depth) => {
    const { tree } = get()
    if (!tree) return
    set({ expandedNodes: new Set(flatten(tree).filter((n) => n.depth < depth).map((n) => n.id)) })
  },

  selectNode: (selectedNodeId) => set({ selectedNodeId }),
  hoverNode: (hoveredNodeId) => set({ hoveredNodeId }),

  search: (q) => {
    const { tree } = get()
    set({ searchQuery: q, searchResults: tree ? searchTree(tree, q) : [] })
  },

  fit: () => set({ fitSignal: get().fitSignal + 1 }),
  zoomToNode: (id) => set({ zoomSignal: { id, n: (get().zoomSignal?.n ?? 0) + 1 }, selectedNodeId: id }),
  setShowLinkGraph: (showLinkGraph) => set({ showLinkGraph })
}))
