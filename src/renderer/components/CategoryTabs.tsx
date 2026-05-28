import { useStore, type TabId } from '../stores/analysisStore'
import { TAB_LABELS } from '../results/columns'

const BASE_ORDER: TabId[] = [
  'overview',
  'seo',
  'performance',
  'content',
  'technical',
  'social',
  'images',
  'links'
]

export function CategoryTabs(): JSX.Element {
  const activeTab = useStore((s) => s.activeTab)
  const setTab = useStore((s) => s.setTab)
  const spiderActive = useStore((s) => s.spiderActive)
  const ORDER: TabId[] = spiderActive ? [...BASE_ORDER, 'graph', 'sitemap'] : BASE_ORDER

  return (
    <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 px-2 overflow-x-auto">
      {ORDER.map((id) => {
        const active = activeTab === id
        return (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              active
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {TAB_LABELS[id]}
          </button>
        )
      })}
    </div>
  )
}
