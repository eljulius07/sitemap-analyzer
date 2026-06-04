import { useStore } from '../../stores/analysisStore'
import { useAugmentedResults } from '../../hooks/useAnalysis'
import { DetailPanel } from '../DetailPanel'
import { SidebarStats } from './SidebarStats'
import { SidebarProblems } from './SidebarProblems'

export function RightSidebar(): JSX.Element {
  const open = useStore((s) => s.sidebarOpen)
  const width = useStore((s) => s.sidebarWidth)
  const setOpen = useStore((s) => s.setSidebarOpen)
  const setWidth = useStore((s) => s.setSidebarWidth)
  const sidebarTab = useStore((s) => s.sidebarTab)
  const setSidebarTab = useStore((s) => s.setSidebarTab)
  const activeTab = useStore((s) => s.activeTab)
  const selectedUrlId = useStore((s) => s.selectedUrlId)
  const augmented = useAugmentedResults()

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Show sidebar"
        className="w-6 shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center"
      >
        ◀
      </button>
    )
  }

  const startResize = (event: React.MouseEvent): void => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (e: MouseEvent): void => {
      // Dragging the LEFT edge: larger when dragging left (clientX decreases).
      setWidth(startWidth + (startX - e.clientX))
    }
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const showUrl = selectedUrlId !== null

  return (
    <aside
      className="shrink-0 relative border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 flex flex-col min-h-0"
      style={{ width }}
    >
      {/* Resize handle on the LEFT edge */}
      <div
        onMouseDown={startResize}
        title="Drag to resize"
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-500/40 z-10"
      />

      {/* Header: sub-tab toggle (or URL detail label) + collapse button */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        {showUrl ? (
          <span className="text-xs font-semibold text-slate-500 px-3 py-2">URL detail</span>
        ) : (
          <div className="flex">
            {(['overview', 'problems'] as const).map((t) => {
              const active = sidebarTab === t
              return (
                <button
                  key={t}
                  onClick={() => setSidebarTab(t)}
                  className={`relative px-3 py-2 text-xs font-medium ${
                    active
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t === 'overview' ? 'Descripción general' : 'Problemas'}
                  {active && (
                    <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-emerald-500 rounded-full" />
                  )}
                </button>
              )
            })}
          </div>
        )}
        <button
          onClick={() => setOpen(false)}
          title="Hide sidebar"
          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm px-3 py-2"
        >
          ▶
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {showUrl ? (
          <DetailPanel />
        ) : sidebarTab === 'problems' ? (
          <SidebarProblems results={augmented} />
        ) : (
          <div className="h-full overflow-auto p-3">
            <SidebarStats results={augmented} tab={activeTab} />
          </div>
        )}
      </div>
    </aside>
  )
}
