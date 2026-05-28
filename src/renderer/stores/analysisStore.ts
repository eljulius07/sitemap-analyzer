import { create } from 'zustand'
import {
  DEFAULT_SETTINGS,
  type AnalyzeProgress,
  type CrawlSettings,
  type CrawlState,
  type UrlResult
} from '@shared/types'

export type View = 'home' | 'results' | 'settings'
export type Theme = 'dark' | 'light'
export type InputMode = 'sitemap' | 'spider'
export type TabId =
  | 'overview'
  | 'seo'
  | 'performance'
  | 'content'
  | 'technical'
  | 'social'
  | 'images'
  | 'links'
  | 'graph'
  | 'sitemap'
export type StatusGroup = '2xx' | '3xx' | '4xx' | '5xx' | 'errors'
export type SeverityFilter = 'critical' | 'warning' | 'info' | 'none'

const SETTINGS_KEY = 'sitemap-analyzer:settings'
const THEME_KEY = 'sitemap-analyzer:theme'

function loadSettings(): CrawlSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS }
}

function loadTheme(): Theme {
  const raw = localStorage.getItem(THEME_KEY)
  if (raw === 'light' || raw === 'dark') return raw
  return 'dark'
}

interface Toast {
  id: number
  kind: 'info' | 'success' | 'error'
  message: string
}

interface AnalysisState {
  view: View
  theme: Theme
  inputMode: InputMode
  spiderActive: boolean
  settings: CrawlSettings

  parsing: boolean
  parseError: string | null
  urls: string[]
  sitemapCount: number
  sitemapSource: string

  crawlState: CrawlState
  progress: AnalyzeProgress | null
  results: UrlResult[]
  toasts: Toast[]

  // results view state
  activeTab: TabId
  selectedUrlId: number | null
  search: string
  statusGroups: Set<StatusGroup>
  severities: Set<SeverityFilter>
  healthMin: number
  healthMax: number
  tabFilters: Set<string>

  setView: (view: View) => void
  setInputMode: (mode: InputMode) => void
  setResults: (results: UrlResult[], spider: boolean) => void
  toggleTheme: () => void
  updateSettings: (patch: Partial<CrawlSettings>) => void
  resetSettings: () => void

  pickFile: () => Promise<void>
  parseFile: (filePath: string) => Promise<void>
  parseUrl: (url: string) => Promise<void>
  clearSitemap: () => void

  startAnalysis: () => Promise<void>
  pause: () => void
  resume: () => void
  cancel: () => void

  setTab: (tab: TabId) => void
  selectUrl: (id: number | null) => void
  setSearch: (q: string) => void
  toggleStatusGroup: (g: StatusGroup) => void
  toggleSeverity: (s: SeverityFilter) => void
  setHealthRange: (min: number, max: number) => void
  toggleTabFilter: (id: string) => void
  clearFilters: () => void

  pushToast: (kind: Toast['kind'], message: string) => void
  dismissToast: (id: number) => void

  _ingest: (batch: UrlResult[]) => void
}

let buffer: UrlResult[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let toastSeq = 1

export const useStore = create<AnalysisState>((set, get) => ({
  view: 'home',
  theme: loadTheme(),
  inputMode: 'sitemap',
  spiderActive: false,
  settings: loadSettings(),

  parsing: false,
  parseError: null,
  urls: [],
  sitemapCount: 0,
  sitemapSource: '',

  crawlState: 'idle',
  progress: null,
  results: [],
  toasts: [],

  activeTab: 'overview',
  selectedUrlId: null,
  search: '',
  statusGroups: new Set(),
  severities: new Set(),
  healthMin: 0,
  healthMax: 100,
  tabFilters: new Set(),

  setView: (view) => set({ view }),
  setInputMode: (inputMode) => set({ inputMode }),

  setResults: (results, spider) =>
    set({
      results,
      spiderActive: spider,
      view: 'results',
      activeTab: 'overview',
      selectedUrlId: null,
      crawlState: 'completed',
      tabFilters: new Set()
    }),

  toggleTheme: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(THEME_KEY, theme)
    set({ theme })
  },

  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    set({ settings })
  },

  resetSettings: () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS))
    set({ settings: { ...DEFAULT_SETTINGS } })
  },

  pickFile: async () => {
    const path = await window.api.pickSitemapFile()
    if (path) await get().parseFile(path)
  },

  parseFile: async (filePath) => {
    set({ parsing: true, parseError: null })
    const res = await window.api.parseSitemapFile(filePath, get().settings)
    if (res.error) {
      set({ parsing: false, parseError: res.error, urls: [], sitemapCount: 0 })
      get().pushToast('error', res.error)
      return
    }
    set({
      parsing: false,
      urls: res.urls,
      sitemapCount: res.sitemapCount,
      sitemapSource: filePath,
      parseError: res.urls.length === 0 ? 'Sitemap contained no URLs.' : null
    })
  },

  parseUrl: async (url) => {
    set({ parsing: true, parseError: null })
    const res = await window.api.parseSitemapUrl(url, get().settings)
    if (res.error) {
      set({ parsing: false, parseError: res.error, urls: [], sitemapCount: 0 })
      get().pushToast('error', res.error)
      return
    }
    set({
      parsing: false,
      urls: res.urls,
      sitemapCount: res.sitemapCount,
      sitemapSource: url,
      parseError: res.urls.length === 0 ? 'Sitemap contained no URLs.' : null
    })
  },

  clearSitemap: () =>
    set({ urls: [], sitemapCount: 0, parseError: null, results: [], progress: null }),

  startAnalysis: async () => {
    const { urls, settings } = get()
    if (urls.length === 0) return
    buffer = []
    set({
      results: [],
      progress: {
        total: urls.length,
        completed: 0,
        inFlight: 0,
        currentUrl: '',
        elapsedMs: 0,
        etaMs: null
      },
      crawlState: 'running',
      selectedUrlId: null,
      view: 'results'
    })

    if (flushTimer) clearInterval(flushTimer)
    flushTimer = setInterval(() => {
      if (buffer.length > 0) {
        const batch = buffer
        buffer = []
        get()._ingest(batch)
      }
    }, 200)

    await window.api.startAnalysis({ urls, settings })
  },

  pause: () => {
    void window.api.pauseAnalysis()
    set({ crawlState: 'paused' })
  },

  resume: () => {
    void window.api.resumeAnalysis()
    set({ crawlState: 'running' })
  },

  cancel: () => {
    void window.api.cancelAnalysis()
    set({ crawlState: 'cancelled' })
  },

  setTab: (tab) => set({ activeTab: tab, tabFilters: new Set() }),
  selectUrl: (id) => set({ selectedUrlId: id }),
  setSearch: (q) => set({ search: q }),

  toggleStatusGroup: (g) => {
    const next = new Set(get().statusGroups)
    next.has(g) ? next.delete(g) : next.add(g)
    set({ statusGroups: next })
  },

  toggleSeverity: (s) => {
    const next = new Set(get().severities)
    next.has(s) ? next.delete(s) : next.add(s)
    set({ severities: next })
  },

  setHealthRange: (min, max) => set({ healthMin: min, healthMax: max }),

  toggleTabFilter: (id) => {
    const next = new Set(get().tabFilters)
    next.has(id) ? next.delete(id) : next.add(id)
    set({ tabFilters: next })
  },

  clearFilters: () =>
    set({
      search: '',
      statusGroups: new Set(),
      severities: new Set(),
      healthMin: 0,
      healthMax: 100,
      tabFilters: new Set()
    }),

  pushToast: (kind, message) => {
    const id = toastSeq++
    set({ toasts: [...get().toasts, { id, kind, message }] })
    setTimeout(() => get().dismissToast(id), 5000)
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  _ingest: (batch) => set({ results: [...get().results, ...batch] })
}))

/** Wire IPC event streams to the store. Call once on app mount. */
export function initIpcBridge(): () => void {
  const flushBuffer = (): void => {
    if (buffer.length > 0) {
      const batch = buffer
      buffer = []
      useStore.getState()._ingest(batch)
    }
  }
  const unsubs = [
    window.api.onProgress((p) => useStore.setState({ progress: p })),
    window.api.onResult((r) => {
      buffer.push(r)
    }),
    window.api.onComplete(({ cancelled }) => {
      flushBuffer()
      if (flushTimer) {
        clearInterval(flushTimer)
        flushTimer = null
      }
      const state = useStore.getState()
      useStore.setState({ crawlState: cancelled ? 'cancelled' : 'completed' })
      state.pushToast(
        cancelled ? 'info' : 'success',
        cancelled
          ? 'Analysis cancelled.'
          : `Analysis complete — ${useStore.getState().results.length} URLs.`
      )
    }),
    window.api.onError(({ message }) => {
      useStore.getState().pushToast('error', message)
    })
  ]
  return () => unsubs.forEach((u) => u())
}
