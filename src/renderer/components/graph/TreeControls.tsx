import { useTreeStore, type TreeLayout } from '../../stores/treeStore'
import type { ColorMode } from './treeUtils'

const LAYOUTS: { id: TreeLayout; label: string }[] = [
  { id: 'tree-vertical', label: '🌳 Tree' },
  { id: 'radial', label: '⭐ Star' },
  { id: 'tree-horizontal', label: '📐 L-R' }
]

const COLOR_MODES: { id: ColorMode; label: string }[] = [
  { id: 'health', label: 'Health Score' },
  { id: 'status', label: 'Status Code' },
  { id: 'responseTime', label: 'Response Time' },
  { id: 'wordCount', label: 'Word Count' },
  { id: 'seo', label: 'SEO Score' },
  { id: 'performance', label: 'Performance' },
  { id: 'depth', label: 'Depth Level' }
]

export function TreeControls(): JSX.Element {
  const t = useTreeStore()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-md overflow-hidden border border-slate-300 dark:border-slate-600">
        {LAYOUTS.map((l) => (
          <button
            key={l.id}
            onClick={() => t.setLayout(l.id)}
            className={`px-2.5 py-1.5 text-xs font-medium ${
              t.layoutMode === l.id ? 'bg-brand-600 text-white' : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <select
        value={t.colorMode}
        onChange={(e) => t.setColorMode(e.target.value as ColorMode)}
        className="px-2 py-1.5 rounded-md border border-slate-300 bg-white text-xs dark:border-slate-600 dark:bg-slate-900"
        title="Color by"
      >
        {COLOR_MODES.map((c) => (
          <option key={c.id} value={c.id}>
            Color: {c.label}
          </option>
        ))}
      </select>

      <button onClick={t.expandAll} className="px-2 py-1.5 rounded-md text-xs border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Expand All</button>
      <button onClick={t.collapseAll} className="px-2 py-1.5 rounded-md text-xs border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Collapse All</button>
      <select
        onChange={(e) => t.expandToDepth(Number(e.target.value))}
        defaultValue="2"
        className="px-2 py-1.5 rounded-md border border-slate-300 bg-white text-xs dark:border-slate-600 dark:bg-slate-900"
        title="Expand to depth"
      >
        {[1, 2, 3, 4, 5, 6].map((d) => (
          <option key={d} value={d}>
            Depth {d}
          </option>
        ))}
      </select>
      <button onClick={t.fit} className="px-2 py-1.5 rounded-md text-xs border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Fit</button>
      <button onClick={() => t.setShowLinkGraph(true)} className="px-2 py-1.5 rounded-md text-xs text-slate-500 hover:underline">
        Show link graph (advanced)
      </button>
    </div>
  )
}
