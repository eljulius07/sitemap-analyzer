import { useMemo } from 'react'
import type { UrlResult } from '@shared/types'
import { healthStrokeColor } from '../utils/format'

interface Pt {
  url: string
  x: number
  y: number
  health: number
}

export function GraphMiniPreview({ results }: { results: UrlResult[] }): JSX.Element {
  const { points, edges } = useMemo(() => {
    const W = 300
    const H = 200
    const cx = W / 2
    const cy = H / 2
    const shown = results.filter((r) => (r.spider?.depth ?? 0) <= 2).slice(0, 80)
    const byDepth = new Map<number, UrlResult[]>()
    for (const r of shown) {
      const d = r.spider?.depth ?? 0
      if (!byDepth.has(d)) byDepth.set(d, [])
      byDepth.get(d)!.push(r)
    }
    const radii = [0, 55, 92]
    const pos = new Map<string, Pt>()
    for (const [depth, list] of byDepth) {
      const radius = radii[Math.min(depth, 2)]
      list.forEach((r, i) => {
        const angle = (i / Math.max(1, list.length)) * Math.PI * 2
        pos.set(r.url, {
          url: r.url,
          x: depth === 0 ? cx : cx + radius * Math.cos(angle),
          y: depth === 0 ? cy : cy + radius * Math.sin(angle),
          health: r.healthScore
        })
      })
    }
    const points = [...pos.values()]
    const edges: { x1: number; y1: number; x2: number; y2: number }[] = []
    for (const r of shown) {
      const from = pos.get(r.url)
      if (!from) continue
      for (const link of r.spider?.internalLinks ?? []) {
        const to = pos.get(link)
        if (to) edges.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y })
      }
    }
    return { points, edges }
  }, [results])

  return (
    <svg viewBox="0 0 300 200" className="w-[300px] h-[200px] rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
      {edges.map((e, i) => (
        <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="currentColor" className="text-slate-300 dark:text-slate-600" strokeWidth={0.5} />
      ))}
      {points.map((p) => (
        <circle key={p.url} cx={p.x} cy={p.y} r={3.5} fill={healthStrokeColor(p.health)}>
          <title>{p.url}</title>
        </circle>
      ))}
      {points.length === 0 && (
        <text x={150} y={100} textAnchor="middle" className="fill-slate-400 text-[11px]">
          discovering…
        </text>
      )}
    </svg>
  )
}
