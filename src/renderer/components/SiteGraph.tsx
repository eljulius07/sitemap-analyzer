import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { GraphEdge, GraphNode } from '@shared/types'
import { useSpiderStore } from '../stores/spiderStore'
import { useGraphStore } from '../stores/graphStore'
import { useStore } from '../stores/analysisStore'
import { healthStrokeColor } from '../utils/format'
import { shortLabel } from '../utils/url'
import { graphToGexf, graphToJson, serializeSvg, svgToPng } from '../utils/graph-export'
import { GraphControls, type GraphActions } from './GraphControls'
import { GraphStats } from './GraphStats'

type DNode = GraphNode & d3.SimulationNodeDatum
type DEdge = { source: DNode; target: DNode; type: GraphEdge['type'] }

function statusGroup(code: number | null): '2xx' | '3xx' | '4xx' | '5xx' | 'err' {
  if (code === null) return 'err'
  if (code >= 500) return '5xx'
  if (code >= 400) return '4xx'
  if (code >= 300) return '3xx'
  return '2xx'
}

function symbolFor(type: GraphNode['type']): d3.SymbolType {
  if (type === 'redirect') return d3.symbolDiamond
  if (type === 'external') return d3.symbolSquare
  if (type === 'error') return d3.symbolTriangle
  return d3.symbolCircle
}

export function SiteGraph(): JSX.Element {
  const graph = useSpiderStore((s) => s.graph)
  const filters = useGraphStore()
  const results = useStore((s) => s.results)
  const selectUrl = useStore((s) => s.selectUrl)
  const pushToast = useStore((s) => s.pushToast)

  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<{ zoom: d3.ZoomBehavior<SVGSVGElement, unknown>; reset: () => void } | null>(null)
  const simRef = useRef<d3.Simulation<DNode, undefined> | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: DNode } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; node: DNode } | null>(null)

  const urlToId = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of results) m.set(r.url, r.id)
    return m
  }, [results])

  const { nodes, edges } = useMemo(() => {
    if (!graph) return { nodes: [] as DNode[], edges: [] as DEdge[] }
    const q = filters.search.trim().toLowerCase()
    const visible = graph.nodes.filter((n) => {
      if (n.type === 'external') return filters.showExternal
      if (n.depth > filters.depthMax) return false
      if (n.healthScore < filters.healthMin) return false
      if (!filters.showStatus.has(statusGroup(n.status) as '2xx') && statusGroup(n.status) !== 'err') return false
      if (n.inDegree < filters.minInDegree && n.depth !== 0) return false
      if (q && !n.url.toLowerCase().includes(q) && !n.pageTitle.toLowerCase().includes(q)) return false
      return true
    })
    const ids = new Set(visible.map((n) => n.id))
    const dnodes: DNode[] = visible.map((n) => ({ ...n }))
    const byId = new Map(dnodes.map((n) => [n.id, n]))
    const dedges: DEdge[] = []
    for (const e of graph.edges) {
      if (ids.has(e.source) && ids.has(e.target)) {
        const s = byId.get(e.source)!
        const t = byId.get(e.target)!
        dedges.push({ source: s, target: t, type: e.type })
      }
    }
    return { nodes: dnodes, edges: dedges }
  }, [graph, filters.search, filters.depthMax, filters.healthMin, filters.minInDegree, filters.showExternal, filters.showStatus])

  useEffect(() => {
    if (!svgRef.current) return
    const svgEl = svgRef.current
    const width = svgEl.clientWidth || 800
    const height = svgEl.clientHeight || 600
    const svg = d3.select<SVGSVGElement, unknown>(svgEl)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const root = svg.append('g')
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 5])
      .on('zoom', (e) => root.attr('transform', e.transform.toString()))
    svg.call(zoom)
    zoomRef.current = {
      zoom,
      reset: () => svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity)
    }

    simRef.current?.stop()

    if (nodes.length === 0) return

    // ---- layout positions ----
    const cx = width / 2
    const cy = height / 2
    const radialGap = Math.min(width, height) / (2 * (filters.depthMax + 2))

    const computeStatic = (): void => {
      if (filters.layout === 'radial') {
        const byDepth = d3.group(nodes, (n) => Math.max(0, n.depth))
        for (const [depth, list] of byDepth) {
          const r = depth * radialGap * 2
          list.forEach((n, i) => {
            const a = (i / list.length) * 2 * Math.PI
            n.x = depth === 0 ? cx : cx + r * Math.cos(a)
            n.y = depth === 0 ? cy : cy + r * Math.sin(a)
            n.fx = n.x
            n.fy = n.y
          })
        }
      } else if (filters.layout === 'cluster') {
        const groups = d3.group(nodes, (n) => n.group)
        const keys = [...groups.keys()]
        const cols = Math.ceil(Math.sqrt(keys.length))
        const cellW = width / cols
        keys.forEach((key, gi) => {
          const list = groups.get(key)!
          const gx = (gi % cols) * cellW + cellW / 2
          const gy = Math.floor(gi / cols) * 160 + 90
          const per = Math.ceil(Math.sqrt(list.length))
          list.forEach((n, i) => {
            n.x = gx + ((i % per) - per / 2) * 26
            n.y = gy + (Math.floor(i / per) - per / 2) * 26
            n.fx = n.x
            n.fy = n.y
          })
        })
      } else if (filters.layout === 'tree') {
        try {
          const idset = new Set(nodes.map((n) => n.id))
          const strat = d3
            .stratify<DNode>()
            .id((n) => n.id)
            .parentId((n) => {
              if (n.depth === 0) return ''
              const meta = results.find((r) => r.url === n.id)?.spider
              const from = meta?.discoveredFrom
              return from && idset.has(from) ? from : ''
            })
          const withRoot = [{ id: '', url: '', depth: -1, status: null, healthScore: 0, pageTitle: '', type: 'page', inDegree: 0, outDegree: 0, group: '' } as DNode, ...nodes]
          const rootH = strat(withRoot)
          const layout = d3.tree<DNode>().size([height - 80, width - 160])
          layout(rootH)
          rootH.each((d) => {
            if (!d.data.id) return
            d.data.x = (d.depth - 1) * ((width - 160) / Math.max(1, rootH.height)) + 90
            d.data.y = (d as unknown as { x: number }).x + 40
            d.data.fx = d.data.x
            d.data.fy = d.data.y
          })
        } catch {
          computeRadialFallback()
        }
      }
    }
    const computeRadialFallback = (): void => {
      nodes.forEach((n, i) => {
        const a = (i / nodes.length) * 2 * Math.PI
        n.x = cx + (n.depth + 1) * radialGap * Math.cos(a)
        n.y = cy + (n.depth + 1) * radialGap * Math.sin(a)
        n.fx = n.x
        n.fy = n.y
      })
    }

    // ---- edges ----
    const link = root
      .append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', (d) => (d.type === 'external' ? '#3b82f6' : '#94a3b8'))
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 0.8)
      .attr('stroke-dasharray', (d) => (d.type === 'external' ? '3,3' : null))

    // ---- nodes ----
    const nodeG = root
      .append('g')
      .selectAll<SVGGElement, DNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('mouseenter', (event: MouseEvent, d) => {
        const rect = svgEl.getBoundingClientRect()
        setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, node: d })
      })
      .on('mouseleave', () => setTooltip(null))
      .on('click', (_e, d) => {
        const id = urlToId.get(d.url)
        if (id !== undefined) selectUrl(id)
      })
      .on('dblclick', (_e, d) => {
        if (d.x == null || d.y == null) return
        svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity.translate(cx - d.x * 1.6, cy - d.y * 1.6).scale(1.6))
      })
      .on('contextmenu', (event: MouseEvent, d) => {
        event.preventDefault()
        const rect = svgEl.getBoundingClientRect()
        setMenu({ x: event.clientX - rect.left, y: event.clientY - rect.top, node: d })
      })

    nodeG
      .append('path')
      .attr('d', (d) => {
        const r = 4 + Math.min(14, d.inDegree * 0.8)
        return d3.symbol().type(symbolFor(d.type)).size(Math.PI * r * r)()
      })
      .attr('fill', (d) => (d.type === 'external' ? '#64748b' : healthStrokeColor(d.healthScore)))
      .attr('stroke', (d) => (statusGroup(d.status) === '4xx' || statusGroup(d.status) === '5xx' || statusGroup(d.status) === 'err' ? '#dc2626' : '#1e293b'))
      .attr('stroke-width', (d) => (statusGroup(d.status) === '4xx' || statusGroup(d.status) === '5xx' ? 2.5 : 0.8))
      .attr('stroke-dasharray', (d) => (statusGroup(d.status) === '3xx' ? '2,2' : null))

    if (filters.showLabels) {
      nodeG
        .append('text')
        .text((d) => shortLabel(d.url, 18))
        .attr('font-size', 8)
        .attr('text-anchor', 'middle')
        .attr('dy', 16)
        .attr('fill', 'currentColor')
        .attr('class', 'text-slate-500')
        .style('pointer-events', 'none')
    }

    nodeG.call(
      d3
        .drag<SVGGElement, DNode>()
        .on('start', (event, d) => {
          if (filters.layout === 'force' && !event.active) simRef.current?.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
          if (filters.layout !== 'force') ticked()
        })
        .on('end', (event) => {
          if (filters.layout === 'force' && !event.active) simRef.current?.alphaTarget(0)
        })
    )

    function ticked(): void {
      link
        .attr('x1', (d) => d.source.x ?? 0)
        .attr('y1', (d) => d.source.y ?? 0)
        .attr('x2', (d) => d.target.x ?? 0)
        .attr('y2', (d) => d.target.y ?? 0)
      nodeG.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    }

    if (filters.layout === 'force') {
      const sim = d3
        .forceSimulation<DNode>(nodes)
        .force('link', d3.forceLink<DNode, DEdge>(edges).id((n) => n.id).distance(40).strength(0.4))
        .force('charge', d3.forceManyBody().strength(-120))
        .force('center', d3.forceCenter(cx, cy))
        .force('collide', d3.forceCollide(14))
        .on('tick', ticked)
      simRef.current = sim
    } else {
      computeStatic()
      ticked()
    }

    return () => {
      simRef.current?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, filters.layout, filters.showLabels])

  const actions: GraphActions = {
    onReset: () => zoomRef.current?.reset(),
    onFit: () => zoomRef.current?.reset(),
    onExportPng: async () => {
      if (!svgRef.current) return
      try {
        const png = await svgToPng(svgRef.current, 2)
        const res = await window.api.saveExportBinary(`site-graph-${Date.now()}.png`, png)
        if (res.saved) pushToast('success', `Saved ${res.path}`)
      } catch (e) {
        pushToast('error', e instanceof Error ? e.message : String(e))
      }
    },
    onExportSvg: async () => {
      if (!svgRef.current) return
      const res = await window.api.saveExport(`site-graph-${Date.now()}.svg`, serializeSvg(svgRef.current))
      if (res.saved) pushToast('success', `Saved ${res.path}`)
    },
    onExportJson: async () => {
      if (!graph) return
      const res = await window.api.saveExport(`site-graph-${Date.now()}.json`, graphToJson(graph))
      if (res.saved) pushToast('success', `Saved ${res.path}`)
    },
    onExportGexf: async () => {
      if (!graph) return
      const res = await window.api.saveExport(`site-graph-${Date.now()}.gexf`, graphToGexf(graph))
      if (res.saved) pushToast('success', `Saved ${res.path}`)
    }
  }

  if (!graph) {
    return <div className="flex-1 flex items-center justify-center text-slate-400">No graph data.</div>
  }

  return (
    <div className="flex h-full min-h-0">
      <GraphControls actions={actions} maxDepth={graph.metadata.maxDepth} />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="relative flex-1 min-h-0" onClick={() => setMenu(null)}>
          <svg ref={svgRef} className="w-full h-full text-slate-500" />
          {nodes.length > 1500 && (
            <div className="absolute top-2 left-2 text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {nodes.length} nodes — rendering may be slow; narrow filters for clarity.
            </div>
          )}
          {tooltip && (
            <div
              className="absolute z-20 pointer-events-none px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs shadow-lg max-w-xs"
              style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
            >
              <div className="font-medium break-all">{tooltip.node.pageTitle || tooltip.node.url}</div>
              <div className="text-slate-300 break-all">{tooltip.node.url}</div>
              <div className="text-slate-400 mt-0.5">
                {tooltip.node.type} · status {tooltip.node.status ?? 'ERR'} · health {tooltip.node.healthScore}
              </div>
              <div className="text-slate-400">
                depth {tooltip.node.depth} · in {tooltip.node.inDegree} · out {tooltip.node.outDegree}
              </div>
            </div>
          )}
          {menu && (
            <div
              className="absolute z-30 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
              style={{ left: menu.x, top: menu.y }}
            >
              {[
                { label: 'Open URL in browser', fn: () => window.open(menu.node.url, '_blank') },
                { label: 'Copy URL', fn: () => void navigator.clipboard.writeText(menu.node.url) },
                {
                  label: 'View in table',
                  fn: () => {
                    const id = urlToId.get(menu.node.url)
                    if (id !== undefined) selectUrl(id)
                  }
                }
              ].map((it) => (
                <button
                  key={it.label}
                  onClick={() => {
                    it.fn()
                    setMenu(null)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  {it.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <GraphStats graph={graph} visibleNodes={nodes.length} visibleEdges={edges.length} />
      </div>
    </div>
  )
}
