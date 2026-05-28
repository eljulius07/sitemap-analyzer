import { useEffect, useState, type RefObject } from 'react'
import * as d3 from 'd3'

const MINI_W = 150
const MINI_H = 100

interface MiniState {
  dots: { x: number; y: number }[]
  view: { x: number; y: number; w: number; h: number } | null
}

export function TreeMinimap({
  svgRef,
  gRef
}: {
  svgRef: RefObject<SVGSVGElement>
  gRef: RefObject<SVGGElement | null>
}): JSX.Element | null {
  const [state, setState] = useState<MiniState>({ dots: [], view: null })

  useEffect(() => {
    const tick = (): void => {
      const svg = svgRef.current
      const g = gRef.current
      if (!svg || !g) return
      const nodeEls = g.querySelectorAll('g.nodes > g.node')
      if (nodeEls.length === 0) {
        setState({ dots: [], view: null })
        return
      }
      const pts: { x: number; y: number }[] = []
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      nodeEls.forEach((el) => {
        const m = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(el.getAttribute('transform') ?? '')
        if (!m) return
        const x = parseFloat(m[1])
        const y = parseFloat(m[2])
        pts.push({ x, y })
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      })
      if (pts.length === 0 || !isFinite(minX)) return
      const pad = 40
      minX -= pad
      minY -= pad
      maxX += pad
      maxY += pad
      const spanX = maxX - minX || 1
      const spanY = maxY - minY || 1
      const scale = Math.min(MINI_W / spanX, MINI_H / spanY)
      const toMini = (x: number, y: number): { x: number; y: number } => ({
        x: (x - minX) * scale,
        y: (y - minY) * scale
      })
      const dots = pts.map((p) => toMini(p.x, p.y))

      const tr = d3.zoomTransform(svg)
      const w = svg.clientWidth || 800
      const h = svg.clientHeight || 600
      const tl = toMini((-tr.x) / tr.k, (-tr.y) / tr.k)
      const view = { x: tl.x, y: tl.y, w: (w / tr.k) * scale, h: (h / tr.k) * scale }
      setState({ dots, view })
    }
    const id = setInterval(tick, 250)
    tick()
    return () => clearInterval(id)
  }, [svgRef, gRef])

  if (state.dots.length === 0) return null

  return (
    <div className="absolute bottom-3 right-3 rounded-md border border-slate-300 bg-white/90 dark:border-slate-600 dark:bg-slate-800/90 shadow">
      <svg width={MINI_W} height={MINI_H}>
        {state.dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={1.3} className="fill-slate-400" />
        ))}
        {state.view && (
          <rect
            x={state.view.x}
            y={state.view.y}
            width={Math.max(4, state.view.w)}
            height={Math.max(4, state.view.h)}
            className="fill-brand-500/10 stroke-brand-500"
            strokeWidth={1}
          />
        )}
      </svg>
    </div>
  )
}
