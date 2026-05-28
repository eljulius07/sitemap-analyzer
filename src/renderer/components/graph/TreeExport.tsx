import { useEffect, useRef, useState, type RefObject } from 'react'
import { useStore } from '../../stores/analysisStore'
import { useTreeStore } from '../../stores/treeStore'
import { toIndentedText, type TreeNode, nodeColor, statusDotColor } from './treeUtils'

function fullSvgString(svgEl: SVGSVGElement, gEl: SVGGElement): { xml: string; w: number; h: number } {
  const bbox = gEl.getBBox()
  const pad = 30
  const w = Math.ceil(bbox.width + pad * 2)
  const h = Math.ceil(bbox.height + pad * 2)
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))
  clone.setAttribute('viewBox', `${bbox.x - pad} ${bbox.y - pad} ${w} ${h}`)
  const g = clone.querySelector('g')
  if (g) g.removeAttribute('transform')
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bg.setAttribute('x', String(bbox.x - pad))
  bg.setAttribute('y', String(bbox.y - pad))
  bg.setAttribute('width', String(w))
  bg.setAttribute('height', String(h))
  bg.setAttribute('fill', '#ffffff')
  clone.insertBefore(bg, clone.firstChild)
  return { xml: '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone), w, h }
}

function rasterize(xml: string, w: number, h: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const scale = Math.min(2, 8000 / Math.max(w, h))
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(w * scale)
      canvas.height = Math.ceil(h * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('no canvas ctx'))
        return
      }
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob((b) => {
        if (!b) return reject(new Error('toBlob failed'))
        b.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(reject)
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('rasterize failed'))
    }
    img.src = url
  })
}

function buildInteractiveHtml(tree: TreeNode, maxDepth: number): string {
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const renderNode = (n: TreeNode): string => {
    const color = nodeColor(n, 'health', maxDepth)
    const dot = statusDotColor(n.status)
    const label = n.depth === 0 ? n.label : '/' + n.label
    const meta = n.isDiscovered ? `${n.status ?? 'ERR'} · ${n.healthScore}/100` : 'not crawled'
    const head = `<span class="dot" style="background:${dot}"></span><span class="lbl">${esc(label)}</span><span class="bar"><i style="width:${n.healthScore}%;background:${color}"></i></span><span class="meta" title="${esc(n.url)}">${esc(meta)}${n.childCount ? ` · ${n.childCount}` : ''}</span>`
    if (n.children.length === 0) return `<li class="leaf">${head}</li>`
    return `<li><details${n.depth < 2 ? ' open' : ''}><summary>${head}</summary><ul>${n.children.map(renderNode).join('')}</ul></details></li>`
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Site Structure: ${esc(tree.label)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:24px;color:#0f172a;background:#fff}
  h1{font-size:18px} .sub{color:#64748b;font-size:12px;margin-bottom:16px}
  ul{list-style:none;padding-left:18px;margin:0} li{margin:2px 0}
  summary{cursor:pointer;display:flex;align-items:center;gap:8px;padding:3px 6px;border-radius:6px}
  summary:hover{background:#f1f5f9} .leaf{display:flex;align-items:center;gap:8px;padding:3px 6px}
  .dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
  .lbl{font-weight:600;font-size:13px} .bar{width:80px;height:7px;background:#e5e7eb;border-radius:4px;overflow:hidden;flex:none}
  .bar i{display:block;height:100%} .meta{font-size:11px;color:#64748b}
  @media(prefers-color-scheme:dark){body{background:#0f172a;color:#e2e8f0}summary:hover{background:#1e293b}.bar{background:#334155}}
</style></head><body>
<h1>Site Structure: ${esc(tree.label)}</h1>
<div class="sub">Generated ${new Date().toLocaleString()} · ${tree.childCount + 1} pages</div>
<ul>${renderNode(tree)}</ul>
</body></html>`
}

export function TreeExport({ svgRef }: { svgRef: RefObject<SVGSVGElement> }): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const tree = useTreeStore((s) => s.tree)
  const pushToast = useStore((s) => s.pushToast)

  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const maxDepth = tree ? Math.max(0, tree.childCount > 0 ? 6 : 0) : 0

  const exportPng = async (): Promise<void> => {
    const svg = svgRef.current
    const g = svg?.querySelector('g')
    if (!svg || !g) return
    try {
      const { xml, w, h } = fullSvgString(svg, g as SVGGElement)
      const png = await rasterize(xml, w, h)
      const res = await window.api.saveExportBinary(`site-tree-${Date.now()}.png`, png)
      if (res.saved) pushToast('success', `Saved ${res.path}`)
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : String(e))
    }
  }
  const exportSvg = async (): Promise<void> => {
    const svg = svgRef.current
    const g = svg?.querySelector('g')
    if (!svg || !g) return
    const { xml } = fullSvgString(svg, g as SVGGElement)
    const res = await window.api.saveExport(`site-tree-${Date.now()}.svg`, xml)
    if (res.saved) pushToast('success', `Saved ${res.path}`)
  }
  const exportHtml = async (): Promise<void> => {
    if (!tree) return
    const res = await window.api.saveExport(`site-tree-${Date.now()}.html`, buildInteractiveHtml(tree, maxDepth))
    if (res.saved) pushToast('success', `Saved ${res.path}`)
  }
  const exportText = async (): Promise<void> => {
    if (!tree) return
    const res = await window.api.saveExport(`site-tree-${Date.now()}.txt`, toIndentedText(tree))
    if (res.saved) pushToast('success', `Saved ${res.path}`)
  }

  const items: [string, () => void][] = [
    ['PNG image', () => void exportPng()],
    ['SVG vector', () => void exportSvg()],
    ['Interactive HTML', () => void exportHtml()],
    ['Indented text', () => void exportText()]
  ]

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-brand-600 text-white hover:bg-brand-700">
        Export ▾
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg z-30 py-1 dark:border-slate-700 dark:bg-slate-800">
          {items.map(([label, fn]) => (
            <button
              key={label}
              onClick={() => {
                setOpen(false)
                fn()
              }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
