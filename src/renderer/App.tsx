import { useEffect } from 'react'
import { initIpcBridge, useStore } from './stores/analysisStore'
import { initSpiderBridge } from './stores/spiderStore'
import { useMemo } from 'react'
import { useResultsView } from './hooks/useAnalysis'
import { SPIDER_COLUMNS, TAB_COLUMNS } from './results/columns'
import { Sidebar } from './components/Sidebar'
import { Toasts } from './components/Toasts'
import { Home } from './components/Home'
import { ProgressBar } from './components/ProgressBar'
import { SummaryPanel } from './components/SummaryPanel'
import { CategoryTabs } from './components/CategoryTabs'
import { GlobalFilters } from './components/GlobalFilters'
import { FilterBar } from './components/FilterBar'
import { ResultsTable } from './components/ResultsTable'
import { DetailPanel } from './components/DetailPanel'
import { ExportMenu } from './components/ExportMenu'
import { SiteTree } from './components/graph/SiteTree'
import { SitemapGenerator } from './components/SitemapGenerator'
import { Settings } from './components/Settings'

function ResultsView(): JSX.Element {
  const crawlState = useStore((s) => s.crawlState)
  const activeTab = useStore((s) => s.activeTab)
  const spiderActive = useStore((s) => s.spiderActive)
  const { augmented, globalFiltered, filtered } = useResultsView()

  const showProgress = crawlState === 'running' || crawlState === 'paused'
  const hasResults = augmented.length > 0
  const isTableTab = activeTab !== 'graph' && activeTab !== 'sitemap'

  const tableColumns = useMemo(
    () => (spiderActive ? [...TAB_COLUMNS[activeTab], ...SPIDER_COLUMNS] : TAB_COLUMNS[activeTab]),
    [spiderActive, activeTab]
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      {showProgress && <ProgressBar />}
      {!hasResults && !showProgress ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          No results yet. Load a sitemap or run the spider from the Home tab.
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="p-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                Results <span className="text-slate-400 font-normal">({augmented.length.toLocaleString()})</span>
              </h2>
              <ExportMenu results={filtered} />
            </div>
            {isTableTab && <SummaryPanel results={augmented} />}
          </div>
          <CategoryTabs />
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
      )}
      <DetailPanel />
    </div>
  )
}

export default function App(): JSX.Element {
  const theme = useStore((s) => s.theme)
  const view = useStore((s) => s.view)

  useEffect(() => {
    const unsubAnalysis = initIpcBridge()
    const unsubSpider = initSpiderBridge()
    return () => {
      unsubAnalysis()
      unsubSpider()
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="flex h-full bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        {view === 'home' && <Home />}
        {view === 'results' && <ResultsView />}
        {view === 'settings' && <Settings />}
      </main>
      <Toasts />
    </div>
  )
}
