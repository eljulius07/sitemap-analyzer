import type { GraphData } from '@shared/types'
import { shortLabel } from '../utils/url'

export function GraphStats({ graph, visibleNodes, visibleEdges }: { graph: GraphData; visibleNodes: number; visibleEdges: number }): JSX.Element {
  const m = graph.metadata
  const Item = ({ label, value }: { label: string; value: string | number }): JSX.Element => (
    <span className="whitespace-nowrap">
      <span className="text-slate-400">{label}:</span> <span className="font-medium">{value}</span>
    </span>
  )
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 text-xs border-t border-slate-200 dark:border-slate-800">
      <Item label="Showing" value={`${visibleNodes} nodes / ${visibleEdges} edges`} />
      <Item label="Total nodes" value={m.totalNodes} />
      <Item label="Internal" value={m.internalCount} />
      <Item label="External" value={m.externalCount} />
      <Item label="Edges" value={m.totalEdges} />
      <Item label="Avg depth" value={m.avgDepth} />
      <Item label="Max depth" value={m.maxDepth} />
      <Item label="Most linked" value={m.mostLinked ? `${shortLabel(m.mostLinked.url)} (${m.mostLinked.inDegree})` : '—'} />
      <Item label="Orphans" value={m.orphans} />
      <Item label="Dead ends" value={m.deadEnds} />
    </div>
  )
}
