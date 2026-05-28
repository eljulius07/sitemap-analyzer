import type { TreeNode } from './treeUtils'

export function TreeTooltip({ x, y, node }: { x: number; y: number; node: TreeNode }): JSX.Element {
  const statusText = node.status === null ? 'Not crawled' : `${node.status}`
  return (
    <div
      className="absolute z-20 pointer-events-none px-3 py-2 rounded-lg bg-slate-900 text-white text-xs shadow-xl max-w-sm"
      style={{ left: x + 14, top: y + 14 }}
    >
      <div className="font-medium break-all">{node.path}</div>
      <div className="text-slate-300 break-all mb-1">{node.url}</div>
      {node.pageTitle && <div>Title: {node.pageTitle}</div>}
      <div className="text-slate-300">
        Status: {statusText}
        {node.isDiscovered ? '' : ' (ghost)'}
      </div>
      {node.isDiscovered && (
        <>
          <div className="text-slate-300">Health: {node.healthScore}/100</div>
          <div className="text-slate-300">Response: {node.responseTime}ms · Words: {node.wordCount.toLocaleString()}</div>
        </>
      )}
      <div className="text-slate-300">Depth: {node.depth} · Children: {node.childCount}</div>
      {node.childCount > 0 && (
        <div className="text-slate-400 mt-1">
          🟢 {node.statusDist.ok} 🟡 {node.statusDist.warn} 🔴 {node.statusDist.err}
        </div>
      )}
    </div>
  )
}
