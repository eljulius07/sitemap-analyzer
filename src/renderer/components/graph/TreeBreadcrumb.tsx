import { useTreeStore } from '../../stores/treeStore'
import { ancestors } from './treeUtils'

export function TreeBreadcrumb(): JSX.Element | null {
  const tree = useTreeStore((s) => s.tree)
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId)
  const zoomToNode = useTreeStore((s) => s.zoomToNode)

  if (!tree || !selectedNodeId) return null
  const path = ancestors(tree, selectedNodeId)
  if (path.length === 0) return null

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 text-xs border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
      {path.map((n, i) => (
        <span key={n.id} className="flex items-center gap-1 whitespace-nowrap">
          {i > 0 && <span className="text-slate-300">›</span>}
          <button
            onClick={() => zoomToNode(n.id)}
            className={`hover:underline ${n.id === selectedNodeId ? 'font-semibold text-brand-500' : 'text-slate-500'}`}
          >
            {i === 0 ? n.label : '/' + n.label}
          </button>
        </span>
      ))}
    </div>
  )
}
