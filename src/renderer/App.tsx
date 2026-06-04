import { useEffect } from 'react'
import { initIpcBridge, useStore } from './stores/analysisStore'
import { initSpiderBridge } from './stores/spiderStore'
import { useMemo } from 'react'
import { useResultsView } from './hooks/useAnalysis'
import { SPIDER_COLUMNS, TAB_COLUMNS } from './results/columns'
import { TopBar } from './components/TopBar'
import { Toasts } from './components/Toasts'
import { Home } from './components/Home'
import { ProgressBar } from './components/ProgressBar'
import { CategoryTabs } from './components/CategoryTabs'
import { GlobalFilters } from './components/GlobalFilters'
import { FilterBar } from './components/FilterBar'
import { ResultsTable } from './components/ResultsTable'
import { ExportMenu } from './components/ExportMenu'
import { SiteTree } from './components/graph/SiteTree'
import { SitemapGenerator } from './components/SitemapGenerator'
import { Settings } from './components/Settings'
import { RightSidebar } from './components/sidebar/RightSidebar'
import { subscribeInspection } from './utils/imageInspectorCache'

function ResultsView(): JSX.Element {
  const crawlState = useStore((s) => s.crawlState)
  const activeTab = useStore((s) => s.activeTab)
  const spiderActive = useStore((s) => s.spiderActive)
  const activeProblem = useStore((s) => s.activeProblem)
  const clearActiveProblem = useStore((s) => s.clearActiveProblem)
  const { augmented, globalFiltered, filtered } = useResultsView()

  const showProgress = crawlState === 'running' || crawlState === 'paused'
  const hasResults = augmented.length > 0
  const isTableTab = activeTab !== 'graph' && activeTab !== 'sitemap'
  const showSidebar = isTableTab

  const tableColumns = useMemo(
    () =>
      spiderActive && isTableTab ? [...TAB_COLUMNS[activeTab], ...SPIDER_COLUMNS] : TAB_COLUMNS[activeTab],
    [spiderActive, activeTab, isTableTab]
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      {showProgress && <ProgressBar />}
      {!hasResults && !showProgress ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          No results yet. Load a sitemap or run the spider from the Home tab.
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          <div className="flex flex-col flex-1 min-w-0 min-h-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-semibold">
                Results <span className="text-slate-400 font-normal">({augmented.length.toLocaleString()})</span>
              </h2>
              <ExportMenu results={filtered} />
            </div>
            <CategoryTabs />

            {/* Active problem filter pill */}
            {activeProblem && isTableTab && (
              <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 text-xs">
                <span className="text-amber-700 dark:text-amber-300">
                  Filtered by ⚠️ <span className="font-semibold">{activeProblem.name}</span> ({activeProblem.urls.size}{' '}
                  URL{activeProblem.urls.size === 1 ? '' : 's'})
                </span>
                <button
                  onClick={clearActiveProblem}
                  className="ml-auto text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
                  title="Clear filter"
                >
                  ✕
                </button>
              </div>
            )}

            {activeTab === 'graph' ? (
              <div className="flex-1 min-h-0">
                <SiteTree />
              </div>
            ) : activeTab === 'sitemap' ? (
              <div className="flex-1 min-h-0 overflow-auto">
                <SitemapGenerator results={augmented} />
              </div>
            ) : (
              <>
                <GlobalFilters />
                <FilterBar results={globalFiltered} />
                <div className="px-4 pb-2 text-xs text-slate-500">
                  {filtered.length.toLocaleString()} of {augmented.length.toLocaleString()} URLs shown
                </div>
                <div className="flex-1 min-h-0 px-4 pb-4">
                  <ResultsTable columns={tableColumns} data={filtered} />
                </div>
              </>
            )}
          </div>

          {showSidebar && <RightSidebar />}
        </div>
      )}
    </div>
  )
}

export default function App(): JSX.Element {
  const theme = useStore((s) => s.theme)
  const view = useStore((s) => s.view)

  useEffect(() => {
    const unsubAnalysis = initIpcBridge()
    const unsubSpider = initSpiderBridge()
    const unsubCache = subscribeInspection(() => {
      useStore.getState().bumpImageCacheVersion()
    })
    return () => {
      unsubAnalysis()
      unsubSpider()
      unsubCache()
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="flex flex-col h-full bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <TopBar />
      <main className="flex-1 min-w-0 min-h-0 flex flex-col">
        {view === 'home' && <Home />}
        {view === 'results' && <ResultsView />}
        {view === 'settings' && <Settings />}
      </main>
      <Toasts />
    </div>
  )
}
