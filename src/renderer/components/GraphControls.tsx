import { useGraphStore, type GraphLayout } from '../stores/graphStore'

const STATUSES: ('2xx' | '3xx' | '4xx' | '5xx')[] = ['2xx', '3xx', '4xx', '5xx']
const LAYOUTS: { id: GraphLayout; label: string }[] = [
  { id: 'force', label: 'Force-Directed' },
  { id: 'radial', label: 'Radial by Depth' },
  { id: 'tree', label: 'Hierarchical Tree' },
  { id: 'cluster', label: 'Cluster by Section' }
]

export interface GraphActions {
  onFit: () => void
  onReset: () => void
  onExportPng: () => void
  onExportSvg: () => void
  onExportJson: () => void
  onExportGexf: () => void
}

function Row({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="py-1.5 border-b border-slate-100 dark:border-slate-700/50">{children}</div>
}

export function GraphControls({ actions, maxDepth }: { actions: GraphActions; maxDepth: number }): JSX.Element {
  const s = useGraphStore()

  return (
    <div className="w-60 shrink-0 overflow-auto border-r border-slate-200 dark:border-slate-800 p-3 text-sm">
      <div className="font-semibold mb-2">Graph Controls</div>

      <Row>
        <label className="text-xs text-slate-500">Layout</label>
        <select
          value={s.layout}
          onChange={(e) => s.setLayout(e.target.value as GraphLayout)}
          className="mt-1 w-full px-2 py-1.5 rounded-md border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-900"
        >
          {LAYOUTS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </Row>

      <Row>
        <label className="text-xs text-slate-500">Max depth: {s.depthMax}</label>
        <input type="range" min={0} max={Math.max(1, maxDepth)} value={Math.min(s.depthMax, maxDepth)} onChange={(e) => s.setDepthMax(Number(e.target.value))} className="w-full" />
      </Row>

      <Row>
        <div className="text-xs text-slate-500 mb-1">Status</div>
        <div className="flex gap-1">
          {STATUSES.map((st) => (
            <button
              key={st}
              onClick={() => s.toggleStatus(st)}
              className={`px-2 py-1 rounded text-xs ${s.showStatus.has(st) ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
            >
              {st}
            </button>
          ))}
        </div>
      </Row>

      <Row>
        <label className="text-xs text-slate-500">Min health: {s.healthMin}</label>
        <input type="range" min={0} max={100} value={s.healthMin} onChange={(e) => s.setHealthMin(Number(e.target.value))} className="w-full" />
      </Row>

      <Row>
        <label className="text-xs text-slate-500">Min in-degree: {s.minInDegree}</label>
        <input type="range" min={0} max={50} value={s.minInDegree} onChange={(e) => s.setMinInDegree(Number(e.target.value))} className="w-full" />
      </Row>

      <Row>
        <label className="flex items-center justify-between text-xs">
          Show external
          <input type="checkbox" checked={s.showExternal} onChange={(e) => s.setShowExternal(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between text-xs mt-1">
          Show labels
          <input type="checkbox" checked={s.showLabels} onChange={(e) => s.setShowLabels(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between text-xs mt-1">
          Show edge labels
          <input type="checkbox" checked={s.showEdgeLabels} onChange={(e) => s.setShowEdgeLabels(e.target.checked)} />
        </label>
      </Row>

      <Row>
        <input
          value={s.search}
          onChange={(e) => s.setSearch(e.target.value)}
          placeholder="Search node 🔍"
          className="w-full px-2 py-1.5 rounded-md border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-900"
        />
      </Row>

      <div className="grid grid-cols-2 gap-1.5 mt-3">
        <button onClick={actions.onReset} className="px-2 py-1.5 rounded-md text-xs border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Reset View</button>
        <button onClick={actions.onFit} className="px-2 py-1.5 rounded-md text-xs border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Fit All</button>
        <button onClick={actions.onExportPng} className="px-2 py-1.5 rounded-md text-xs border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Export PNG</button>
        <button onClick={actions.onExportSvg} className="px-2 py-1.5 rounded-md text-xs border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Export SVG</button>
        <button onClick={actions.onExportJson} className="px-2 py-1.5 rounded-md text-xs border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Export JSON</button>
        <button onClick={actions.onExportGexf} className="px-2 py-1.5 rounded-md text-xs border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Export GEXF</button>
      </div>
    </div>
  )
}
