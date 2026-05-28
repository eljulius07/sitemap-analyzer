import { create } from 'zustand'

export type GraphLayout = 'force' | 'radial' | 'tree' | 'cluster'

interface GraphStore {
  layout: GraphLayout
  depthMax: number
  showStatus: Set<'2xx' | '3xx' | '4xx' | '5xx'>
  healthMin: number
  minInDegree: number
  showExternal: boolean
  showLabels: boolean
  showEdgeLabels: boolean
  search: string

  setLayout: (l: GraphLayout) => void
  setDepthMax: (d: number) => void
  toggleStatus: (s: '2xx' | '3xx' | '4xx' | '5xx') => void
  setHealthMin: (h: number) => void
  setMinInDegree: (n: number) => void
  setShowExternal: (v: boolean) => void
  setShowLabels: (v: boolean) => void
  setShowEdgeLabels: (v: boolean) => void
  setSearch: (q: string) => void
  reset: () => void
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  layout: 'force',
  depthMax: 10,
  showStatus: new Set(['2xx', '3xx', '4xx', '5xx']),
  healthMin: 0,
  minInDegree: 0,
  showExternal: false,
  showLabels: true,
  showEdgeLabels: false,
  search: '',

  setLayout: (layout) => set({ layout }),
  setDepthMax: (depthMax) => set({ depthMax }),
  toggleStatus: (s) => {
    const next = new Set(get().showStatus)
    next.has(s) ? next.delete(s) : next.add(s)
    set({ showStatus: next })
  },
  setHealthMin: (healthMin) => set({ healthMin }),
  setMinInDegree: (minInDegree) => set({ minInDegree }),
  setShowExternal: (showExternal) => set({ showExternal }),
  setShowLabels: (showLabels) => set({ showLabels }),
  setShowEdgeLabels: (showEdgeLabels) => set({ showEdgeLabels }),
  setSearch: (search) => set({ search }),
  reset: () =>
    set({
      layout: 'force',
      depthMax: 10,
      showStatus: new Set(['2xx', '3xx', '4xx', '5xx']),
      healthMin: 0,
      minInDegree: 0,
      showExternal: false,
      search: ''
    })
}))
