import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useStore } from '../../stores/analysisStore'
import { useSpiderStore } from '../../stores/spiderStore'
import { useTreeStore } from '../../stores/treeStore'
import { useAugmentedResults } from '../../hooks/useAnalysis'
import {
  NODE_H,
  NODE_W,
  nodeBorder,
  nodeColor,
  statusDotColor,
  type ColorMode,
  type TreeNode
} from './treeUtils'
import { SiteGraph } from '../SiteGraph'
import { TreeControls } from './TreeControls'
import { TreeBreadcrumb } from './TreeBreadcrumb'
import { TreeSearch } from './TreeSearch'
import { TreeExport } from './TreeExport'
import { TreeTooltip } from './TreeTooltip'
import { TreeMinimap } from './TreeMinimap'

type HNode = d3.HierarchyNode<TreeNode> & { x: number; y: number; px?: number; py?: number }

const H_GAP = 26
const V_GAP = 70

function bgFor(n: TreeNode): string {
  if (!n.isDiscovered) return '#f9fafb'
  const s = n.status
  if (s === null || s >= 400) return '#fef2f2'
  if (s >= 300) return '#eff6ff'
  if (n.healthScore < 20) return '#fef2f2'
  return '#ffffff'
}

function metric(n: TreeNode, mode: ColorMode, maxDepth: number): { frac: number; text: string } {
  switch (mode) {
    case 'status':
      return { frac: 1, text: n.status === null ? 'ERR' : String(n.status) }
    case 'responseTime':
      return { frac: Math.max(0.05, 1 - n.responseTime / 3000), text: `${n.responseTime}ms` }
    case 'wordCount':
      return { frac: Math.max(0.05, Math.min(1, n.wordCount / 1000)), text: String(n.wordCount) }
    case 'seo':
      return { frac: n.seoScore / 100, text: String(n.seoScore) }
    case 'performance':
      return { frac: n.perfScore / 100, text: String(n.perfScore) }
    case 'depth':
      return { frac: Math.max(0.05, n.depth / (maxDepth || 1)), text: `d${n.depth}` }
    case 'health':
    default:
      return { frac: n.healthScore / 100, text: String(n.healthScore) }
  }
}

function cartesian(d: HNode, layout: string): { x: number; y: number } {
  if (layout === 'radial') {
    const angle = d.x - Math.PI / 2
    const r = d.y
    return { x: r * Math.cos(angle), y: r * Math.sin(angle) }
  }
  if (layout === 'tree-horizontal') return { x: d.y, y: d.x }
  return { x: d.x, y: d.y }
}

function linkPath(s: { x: number; y: number }, t: { x: number; y: number }, layout: string): string {
  if (layout === 'tree-horizontal') {
    const mx = (s.x + t.x) / 2
    return `M${s.x},${s.y}C${mx},${s.y} ${mx},${t.y} ${t.x},${t.y}`
  }
  if (layout === 'radial') return `M${s.x},${s.y}L${t.x},${t.y}`
  const my = (s.y + t.y) / 2
  return `M${s.x},${s.y}C${s.x},${my} ${t.x},${my} ${t.x},${t.y}`
}

export function SiteTree(): JSX.Element {
  const results = useAugmentedResults()
  const startUrl = useSpiderStore((s) => s.config.startUrl)
  const t = useTreeStore()
  const selectUrl = useStore((s) => s.selectUrl)

  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const posRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: TreeNode } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null)

  // Build tree whenever the result set changes.
  useEffect(() => {
    if (results.length === 0) return
    const depthZero = results.find((r) => r.spider?.depth === 0)?.url
    const shortest = [...results].sort(
      (a, b) => a.url.split('/').length - b.url.split('/').length
    )[0]?.url
    t.buildFromResults(results, startUrl || depthZero || shortest || results[0].url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, startUrl])

  // Init svg + zoom once.
  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    const g = svg.append('g')
    gRef.current = g.node()
    g.append('g').attr('class', 'links')
    g.append('g').attr('class', 'nodes')
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 3])
      .on('zoom', (e) => g.attr('transform', e.transform.toString()))
    svg.call(zoom)
    zoomRef.current = zoom
    posRef.current.clear()
  }, [t.showLinkGraph])

  // Render / update on tree + view changes.
  useEffect(() => {
    if (!svgRef.current || !gRef.current || !t.tree) return
    const layout = t.layoutMode
    const g = d3.select(gRef.current)
    const maxDepth = t.tree.childCount > 0 ? Math.max(...flattenDepth(t.tree)) : 0

    const root = d3.hierarchy(t.tree, (d) => (t.expandedNodes.has(d.id) ? d.children : null)) as HNode
    const visibleDepth = root.height
    const maxRadius = (visibleDepth + 1) * 150

    if (layout === 'radial') {
      d3
        .tree<TreeNode>()
        .size([2 * Math.PI, maxRadius])
        .separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(1, a.depth))(root)
    } else if (layout === 'tree-horizontal') {
      d3.tree<TreeNode>().nodeSize([NODE_H + 16, NODE_W + V_GAP])(root)
    } else {
      d3.tree<TreeNode>().nodeSize([NODE_W + H_GAP, NODE_H + V_GAP])(root)
    }

    const nodes = root.descendants() as HNode[]
    const links = root.links()
    for (const n of nodes) {
      const c = cartesian(n, layout)
      n.x = c.x
      n.y = c.y
    }

    const dur = 400
    const ease = d3.easeCubicOut
    const prev = posRef.current
    const parentPos = (d: HNode): { x: number; y: number } =>
      d.parent ? prev.get((d.parent as HNode).data.id) ?? { x: d.x, y: d.y } : { x: d.x, y: d.y }

    // ---- links ----
    const linkSel = g
      .select('g.links')
      .selectAll<SVGPathElement, d3.HierarchyLink<TreeNode>>('path')
      .data(links, (d) => (d.target as HNode).data.id)
    linkSel
      .exit()
      .transition()
      .duration(dur)
      .attr('opacity', 0)
      .remove()
    const linkEnter = linkSel
      .enter()
      .append('path')
      .attr('fill', 'none')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1)
      .attr('opacity', 0)
      .attr('d', (d) => {
        const p = parentPos(d.source as HNode)
        return linkPath(p, p, layout)
      })
    linkEnter
      .merge(linkSel)
      .transition()
      .duration(dur)
      .ease(ease)
      .attr('opacity', 0.5)
      .attr('d', (d) => linkPath(d.source as HNode, d.target as HNode, layout))

    // ---- nodes ----
    const nodeSel = g
      .select('g.nodes')
      .selectAll<SVGGElement, HNode>('g.node')
      .data(nodes, (d) => d.data.id)

    nodeSel
      .exit()
      .transition()
      .duration(dur)
      .attr('opacity', 0)
      .attr('transform', (d) => {
        const p = parentPos(d as HNode)
        return `translate(${p.x},${p.y})`
      })
      .remove()

    const nodeEnter = nodeSel
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('opacity', 0)
      .attr('transform', (d) => {
        const p = parentPos(d)
        return `translate(${p.x},${p.y})`
      })
      .style('cursor', 'pointer')

    // shape
    nodeEnter
      .append('rect')
      .attr('class', 'node-rect')
      .attr('width', NODE_W)
      .attr('height', NODE_H)
      .attr('x', -NODE_W / 2)
      .attr('y', -NODE_H / 2)
      .attr('rx', 8)
    nodeEnter
      .append('circle')
      .attr('class', 'status-dot')
      .attr('r', 4)
      .attr('cx', -NODE_W / 2 + 12)
      .attr('cy', 8)
    nodeEnter.append('rect').attr('class', 'bar-bg').attr('x', -NODE_W / 2 + 24).attr('y', 4).attr('height', 8).attr('rx', 3).attr('fill', '#e5e7eb')
    nodeEnter.append('rect').attr('class', 'bar-fill').attr('x', -NODE_W / 2 + 24).attr('y', 4).attr('height', 8).attr('rx', 3)
    nodeEnter.append('text').attr('class', 'label').attr('y', -6).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', 600)
    nodeEnter.append('text').attr('class', 'metric-text').attr('y', 11).attr('font-size', 8).attr('fill', '#64748b')
    nodeEnter.append('text').attr('class', 'badge').attr('x', NODE_W / 2 - 8).attr('y', -6).attr('text-anchor', 'end').attr('font-size', 9).attr('fill', '#64748b')
    nodeEnter.append('text').attr('class', 'caret').attr('y', NODE_H / 2 + 12).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', '#64748b')

    // events
    nodeEnter
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation()
        t.selectNode(d.data.id)
        if (d.data.resultId !== null) selectUrl(d.data.resultId)
      })
      .on('dblclick', (event: MouseEvent, d) => {
        event.stopPropagation()
        t.expandSubtree(d.data.id)
      })
      .on('mouseenter', (event: MouseEvent, d) => {
        const rect = svgRef.current!.getBoundingClientRect()
        setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, node: d.data })
        t.hoverNode(d.data.id)
      })
      .on('mouseleave', () => {
        setTooltip(null)
        t.hoverNode(null)
      })
      .on('contextmenu', (event: MouseEvent, d) => {
        event.preventDefault()
        const rect = svgRef.current!.getBoundingClientRect()
        setMenu({ x: event.clientX - rect.left, y: event.clientY - rect.top, node: d.data })
      })

    const merged = nodeEnter.merge(nodeSel)
    merged
      .transition()
      .duration(dur)
      .ease(ease)
      .attr('opacity', 1)
      .attr('transform', (d) => `translate(${d.x},${d.y})`)

    merged.select<SVGRectElement>('rect.node-rect').each(function (d) {
      const border = nodeBorder(d.data)
      d3.select(this)
        .attr('fill', bgFor(d.data))
        .attr('stroke', border.color)
        .attr('stroke-width', border.width)
        .attr('stroke-dasharray', border.dashed ? '4,3' : null)
    })
    merged.select('circle.status-dot').attr('fill', (d) => statusDotColor(d.data.status))
    merged.select('rect.bar-bg').attr('width', NODE_W - 60)
    merged.select('rect.bar-fill').each(function (d) {
      const m = metric(d.data, t.colorMode, maxDepth)
      d3.select(this)
        .attr('width', (NODE_W - 60) * Math.max(0, Math.min(1, m.frac)))
        .attr('fill', nodeColor(d.data, t.colorMode, maxDepth))
    })
    merged.select('text.label').text((d) => {
      const raw = d.data.depth === 0 ? d.data.label : '/' + d.data.label
      return raw.length > 24 ? raw.slice(0, 23) + '…' : raw
    })
    merged.select('text.label').attr('fill', '#0f172a')
    merged.select('text.metric-text').attr('x', NODE_W / 2 - 8).attr('text-anchor', 'end').text((d) => metric(d.data, t.colorMode, maxDepth).text)
    merged.select('text.badge').text((d) => (!t.expandedNodes.has(d.data.id) && d.data.childCount > 0 ? `[${d.data.childCount}]` : ''))
    merged.select('text.caret').text((d) => (d.data.children.length === 0 ? '' : t.expandedNodes.has(d.data.id) ? '▼' : '▶'))

    // caret click toggles expand
    merged.select<SVGTextElement>('text.caret').on('click', (event: MouseEvent, d) => {
      event.stopPropagation()
      t.toggleExpand((d as HNode).data.id)
    })

    // search highlight
    merged.select('rect.node-rect').classed('tree-pulse', (d) => t.searchResults.includes(d.data.id))
    // selection ring
    merged.select('rect.node-rect').attr('stroke-width', (d) => {
      const border = nodeBorder(d.data)
      return d.data.id === t.selectedNodeId ? border.width + 2 : border.width
    })

    // store positions for next transition
    prev.clear()
    for (const n of nodes) prev.set(n.data.id, { x: n.x, y: n.y })
  }, [t.tree, t.expandedNodes, t.layoutMode, t.colorMode, t.searchResults, t.selectedNodeId, t.showLinkGraph, selectUrl])

  // Fit to view.
  useEffect(() => {
    if (!svgRef.current || !gRef.current || !zoomRef.current) return
    const svgEl = svgRef.current
    const g = gRef.current
    const bbox = g.getBBox()
    if (bbox.width === 0 || bbox.height === 0) return
    const w = svgEl.clientWidth || 800
    const h = svgEl.clientHeight || 600
    const scale = Math.min(2, 0.9 / Math.max(bbox.width / w, bbox.height / h))
    const tx = w / 2 - (bbox.x + bbox.width / 2) * scale
    const ty = h / 2 - (bbox.y + bbox.height / 2) * scale
    d3.select(svgEl).transition().duration(400).call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.fitSignal])

  // Zoom to a node.
  useEffect(() => {
    if (!t.zoomSignal || !svgRef.current || !zoomRef.current) return
    const pos = posRef.current.get(t.zoomSignal.id)
    if (!pos) return
    const svgEl = svgRef.current
    const w = svgEl.clientWidth || 800
    const h = svgEl.clientHeight || 600
    const scale = 1.1
    d3.select(svgEl)
      .transition()
      .duration(500)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(w / 2 - pos.x * scale, h / 2 - pos.y * scale).scale(scale))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.zoomSignal])

  if (t.showLinkGraph) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800">
          <button onClick={() => t.setShowLinkGraph(false)} className="text-xs text-brand-500 hover:underline">
            ← Back to tree view
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <SiteGraph />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-800">
        <TreeControls />
        <div className="flex-1" />
        <TreeSearch />
        <TreeExport svgRef={svgRef} />
      </div>
      <TreeBreadcrumb />
      <div className="relative flex-1 min-h-0 bg-slate-50 dark:bg-slate-950" onClick={() => setMenu(null)}>
        <svg ref={svgRef} className="w-full h-full" />
        {tooltip && <TreeTooltip x={tooltip.x} y={tooltip.y} node={tooltip.node} />}
        {menu && (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            node={menu.node}
            onClose={() => setMenu(null)}
            onSelect={() => menu.node.resultId !== null && selectUrl(menu.node.resultId)}
          />
        )}
        <TreeMinimap svgRef={svgRef} gRef={gRef} />
        <div className="absolute bottom-2 left-3 text-xs text-slate-400 pointer-events-none">
          {t.tree?.childCount ?? 0} pages · scroll to zoom · drag to pan
        </div>
      </div>
    </div>
  )
}

function ContextMenu({
  x,
  y,
  node,
  onClose,
  onSelect
}: {
  x: number
  y: number
  node: TreeNode
  onClose: () => void
  onSelect: () => void
}): JSX.Element {
  const t = useTreeStore()
  const items: [string, () => void][] = [
    ['Expand all', () => t.expandSubtree(node.id)],
    ['Collapse all', () => t.collapseSubtree(node.id)],
    ['Open URL', () => window.open(node.url, '_blank')],
    ['Copy URL', () => void navigator.clipboard.writeText(node.url)],
    ['View analysis', onSelect]
  ]
  return (
    <div
      className="absolute z-30 w-40 rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
      style={{ left: x, top: y }}
    >
      {items.map(([label, fn]) => (
        <button
          key={label}
          onClick={() => {
            fn()
            onClose()
          }}
          className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function flattenDepth(node: TreeNode, acc: number[] = []): number[] {
  acc.push(node.depth)
  node.children.forEach((c) => flattenDepth(c, acc))
  return acc
}
