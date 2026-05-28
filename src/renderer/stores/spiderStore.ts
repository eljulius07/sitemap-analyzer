import { create } from 'zustand'
import {
  DEFAULT_SPIDER_CONFIG,
  type GraphData,
  type SpiderConfig,
  type SpiderProgress,
  type UrlResult
} from '@shared/types'
import { buildGraph } from '../utils/graph-builder'
import { useStore } from './analysisStore'

const CONFIG_KEY = 'sitemap-analyzer:spider-config'

function loadConfig(): SpiderConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) return { ...DEFAULT_SPIDER_CONFIG, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SPIDER_CONFIG }
}

interface SpiderStore {
  config: SpiderConfig
  running: boolean
  paused: boolean
  progress: SpiderProgress | null
  pageResults: UrlResult[]
  graph: GraphData | null
  robotsSitemaps: string[]

  updateConfig: (patch: Partial<SpiderConfig>) => void
  start: () => Promise<void>
  pause: () => void
  resume: () => void
  cancel: () => void
  reset: () => void
  _ingest: (batch: UrlResult[]) => void
  _finalize: (cancelled: boolean, robotsSitemaps: string[]) => void
}

let buffer: UrlResult[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null

export const useSpiderStore = create<SpiderStore>((set, get) => ({
  config: loadConfig(),
  running: false,
  paused: false,
  progress: null,
  pageResults: [],
  graph: null,
  robotsSitemaps: [],

  updateConfig: (patch) => {
    const config = { ...get().config, ...patch }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
    set({ config })
  },

  start: async () => {
    const { config } = get()
    if (!config.startUrl.trim()) return
    buffer = []
    set({ running: true, paused: false, pageResults: [], graph: null, progress: null, robotsSitemaps: [] })
    if (flushTimer) clearInterval(flushTimer)
    flushTimer = setInterval(() => {
      if (buffer.length > 0) {
        const batch = buffer
        buffer = []
        get()._ingest(batch)
      }
    }, 250)
    await window.api.startSpider(config)
  },

  pause: () => {
    void window.api.pauseSpider()
    set({ paused: true })
  },
  resume: () => {
    void window.api.resumeSpider()
    set({ paused: false })
  },
  cancel: () => {
    void window.api.cancelSpider()
  },

  reset: () => set({ running: false, paused: false, progress: null, pageResults: [], graph: null }),

  _ingest: (batch) => set({ pageResults: [...get().pageResults, ...batch] }),

  _finalize: (_cancelled, robotsSitemaps) => {
    if (flushTimer) {
      clearInterval(flushTimer)
      flushTimer = null
    }
    if (buffer.length > 0) {
      const batch = buffer
      buffer = []
      set({ pageResults: [...get().pageResults, ...batch] })
    }
    const { config, pageResults } = get()
    const { results, graph } = buildGraph(pageResults, config.startUrl, config.includeExternal)
    // Re-index sequential ids so the table/detail panel lookups are stable.
    const reindexed = results.map((r, i) => ({ ...r, id: i }))
    set({ running: false, paused: false, graph, robotsSitemaps })
    useStore.getState().setResults(reindexed, true)
    useStore.getState().pushToast('success', `Spider finished — ${reindexed.length} pages, ${graph.metadata.totalEdges} links.`)
  }
}))

export function initSpiderBridge(): () => void {
  const unsubs = [
    window.api.onSpiderProgress((p) => useSpiderStore.setState({ progress: p })),
    window.api.onSpiderPageResult(({ result }) => {
      buffer.push(result)
    }),
    window.api.onSpiderComplete(({ cancelled, robotsSitemaps }) => {
      useSpiderStore.getState()._finalize(cancelled, robotsSitemaps)
    }),
    window.api.onSpiderError(({ message }) => {
      useStore.getState().pushToast('error', message)
    })
  ]
  return () => unsubs.forEach((u) => u())
}
