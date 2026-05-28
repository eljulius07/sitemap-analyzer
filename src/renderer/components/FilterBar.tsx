import { useMemo } from 'react'
import type { UrlResult } from '@shared/types'
import { useStore } from '../stores/analysisStore'
import { TAB_FILTERS } from '../results/filters'

export function FilterBar({ results }: { results: UrlResult[] }): JSX.Element | null {
  const activeTab = useStore((s) => s.activeTab)
  const tabFilters = useStore((s) => s.tabFilters)
  const toggleTabFilter = useStore((s) => s.toggleTabFilter)
  const clearFilters = useStore((s) => s.clearFilters)

  const defs = TAB_FILTERS[activeTab]

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const def of defs) {
      let count = 0
      for (const r of results) if (def.test(r)) count++
      map.set(def.id, count)
    }
    return map
  }, [defs, results])

  if (defs.length === 0) return null

  const hasActive = tabFilters.size > 0

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
      {defs.map((def) => {
        const active = tabFilters.has(def.id)
        const count = counts.get(def.id) ?? 0
        return (
          <button
            key={def.id}
            onClick={() => toggleTabFilter(def.id)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              active
                ? 'border-brand-500 bg-brand-600 text-white'
                : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {def.label}{' '}
            <span className={active ? 'opacity-80' : 'text-slate-400'}>({count})</span>
          </button>
        )
      })}
      {hasActive && (
        <button
          onClick={clearFilters}
          className="px-2.5 py-1 rounded-full text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
        >
          Clear All Filters
        </button>
      )}
    </div>
  )
}
