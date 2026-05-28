import type { UrlResult } from '@shared/types'

export interface TreeNode {
  id: string
  url: string
  path: string
  label: string
  depth: number
  status: number | null
  healthScore: number
  pageTitle: string
  responseTime: number
  wordCount: number
  seoScore: number
  perfScore: number
  children: TreeNode[]
  childCount: number
  isDiscovered: boolean
  resultId: number | null
  statusDist: { ok: number; warn: number; err: number }
}

export type ColorMode =
  | 'health'
  | 'status'
  | 'responseTime'
  | 'wordCount'
  | 'seo'
  | 'performance'
  | 'depth'

export const NODE_W = 168
export const NODE_H = 46

function stripTrailing(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

function segmentsOf(path: string): string[] {
  return path.split('/').filter(Boolean)
}

function parse(url: string): { origin: string; segments: string[] } | null {
  try {
    const u = new URL(url)
    return { origin: u.origin, segments: segmentsOf(u.pathname) }
  } catch {
    return null
  }
}

function makeNode(
  id: string,
  url: string,
  path: string,
  label: string,
  depth: number
): TreeNode {
  return {
    id,
    url,
    path,
    label,
    depth,
    status: null,
    healthScore: 0,
    pageTitle: '',
    responseTime: 0,
    wordCount: 0,
    seoScore: 0,
    perfScore: 0,
    children: [],
    childCount: 0,
    isDiscovered: false,
    resultId: null,
    statusDist: { ok: 0, warn: 0, err: 0 }
  }
}

function applyResult(node: TreeNode, r: UrlResult): void {
  node.isDiscovered = true
  node.resultId = r.id
  node.status = r.http.statusCode
  node.healthScore = r.healthScore
  node.pageTitle = r.seo?.title ?? ''
  node.responseTime = r.http.ttfbMs
  node.wordCount = r.content?.wordCount ?? 0
  node.seoScore = r.scores.seo
  node.perfScore = r.scores.performance
}

/**
 * Build a URL-path hierarchy tree (NOT the link graph). A page's parent is the
 * URL one path segment shorter. Missing intermediates become ghost nodes.
 */
export function buildTree(results: UrlResult[], startUrl: string): TreeNode {
  const base = parse(startUrl) ?? parse(results[0]?.url ?? 'http://site')
  const origin = base?.origin ?? 'http://site'
  const rootSegs = base?.segments ?? []
  const rootPath = '/' + rootSegs.join('/')
  const host = origin.replace(/^https?:\/\//, '')

  const rootUrl = stripTrailing(origin + (rootPath === '/' ? '/' : rootPath))
  const root = makeNode(rootUrl, rootUrl, rootPath, host + (rootPath !== '/' ? rootPath : ''), 0)

  const byUrl = new Map<string, UrlResult>()
  for (const r of results) byUrl.set(stripTrailing(r.url.replace(/#.*$/, '')), r)

  const rootResult = byUrl.get(rootUrl)
  if (rootResult) applyResult(root, rootResult)

  // Relative segments (below the start path) define tree position.
  const entries = results
    .map((r) => {
      const p = parse(r.url)
      if (!p || p.origin !== origin) return null
      const segs = p.segments
      // must be under root path
      for (let i = 0; i < rootSegs.length; i++) if (segs[i] !== rootSegs[i]) return null
      return { r, rel: segs.slice(rootSegs.length) }
    })
    .filter((e): e is { r: UrlResult; rel: string[] } => e !== null)
    .sort((a, b) => a.rel.length - b.rel.length)

  for (const { r, rel } of entries) {
    if (rel.length === 0) continue // root itself
    let current = root
    for (let i = 0; i < rel.length; i++) {
      const seg = rel[i]
      let child = current.children.find((c) => c.label === seg)
      if (!child) {
        const absSegs = [...rootSegs, ...rel.slice(0, i + 1)]
        const childUrl = stripTrailing(origin + '/' + absSegs.join('/'))
        child = makeNode(childUrl, childUrl, '/' + absSegs.join('/'), seg, current.depth + 1)
        const exact = byUrl.get(childUrl)
        if (exact) applyResult(child, exact)
        current.children.push(child)
      }
      current = child
    }
    if (!current.isDiscovered) applyResult(current, r)
  }

  computeAggregates(root)
  sortChildren(root)
  return root
}

function statusBucket(status: number | null): 'ok' | 'warn' | 'err' {
  if (status === null) return 'err'
  if (status >= 400) return 'err'
  if (status >= 300) return 'warn'
  return 'ok'
}

/** Recursively compute descendant counts + status distribution. */
export function computeAggregates(node: TreeNode): void {
  let count = 0
  const dist = { ok: 0, warn: 0, err: 0 }
  for (const child of node.children) {
    computeAggregates(child)
    count += 1 + child.childCount
    dist.ok += child.statusDist.ok + (statusBucket(child.status) === 'ok' ? 1 : 0)
    dist.warn += child.statusDist.warn + (statusBucket(child.status) === 'warn' ? 1 : 0)
    dist.err += child.statusDist.err + (statusBucket(child.status) === 'err' ? 1 : 0)
  }
  node.childCount = count
  node.statusDist = dist
}

/** Directories (have children) first, then leaves; alpha within each group. */
export function sortChildren(node: TreeNode): void {
  node.children.sort((a, b) => {
    const ad = a.children.length > 0 ? 0 : 1
    const bd = b.children.length > 0 ? 0 : 1
    if (ad !== bd) return ad - bd
    return a.label.localeCompare(b.label)
  })
  node.children.forEach(sortChildren)
}

export function flatten(root: TreeNode): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (n: TreeNode): void => {
    out.push(n)
    n.children.forEach(walk)
  }
  walk(root)
  return out
}

export function ancestors(root: TreeNode, id: string): TreeNode[] {
  const path: TreeNode[] = []
  const dfs = (n: TreeNode): boolean => {
    path.push(n)
    if (n.id === id) return true
    for (const c of n.children) if (dfs(c)) return true
    path.pop()
    return false
  }
  dfs(root)
  return path
}

export function searchTree(root: TreeNode, query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return flatten(root)
    .filter((n) => n.url.toLowerCase().includes(q) || n.pageTitle.toLowerCase().includes(q))
    .map((n) => n.id)
}

// ---- colors ----
function lerpColor(stops: [number, string][], v: number): string {
  for (let i = 0; i < stops.length - 1; i++) {
    const [v0, c0] = stops[i]
    const [v1, c1] = stops[i + 1]
    if (v <= v1) {
      const t = (v - v0) / (v1 - v0 || 1)
      return mix(c0, c1, Math.max(0, Math.min(1, t)))
    }
  }
  return stops[stops.length - 1][1]
}
function mix(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)]
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)]
  const r = pa.map((x, i) => Math.round(x + (pb[i] - x) * t))
  return `#${r.map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

const HEALTH_STOPS: [number, string][] = [
  [0, '#ef4444'],
  [50, '#eab308'],
  [80, '#22c55e'],
  [100, '#16a34a']
]

export function nodeColor(node: TreeNode, mode: ColorMode, maxDepth: number): string {
  if (!node.isDiscovered) return '#9ca3af'
  switch (mode) {
    case 'status': {
      const s = node.status ?? 0
      if (s >= 500) return '#ef4444'
      if (s >= 400) return '#f97316'
      if (s >= 300) return '#3b82f6'
      return '#22c55e'
    }
    case 'responseTime':
      return lerpColor([[0, '#22c55e'], [500, '#22c55e'], [1500, '#eab308'], [3000, '#ef4444']], node.responseTime)
    case 'wordCount':
      return lerpColor([[0, '#ef4444'], [100, '#ef4444'], [500, '#eab308'], [1000, '#22c55e']], node.wordCount)
    case 'seo':
      return lerpColor(HEALTH_STOPS, node.seoScore)
    case 'performance':
      return lerpColor(HEALTH_STOPS, node.perfScore)
    case 'depth':
      return lerpColor([[0, '#dbeafe'], [maxDepth || 1, '#1e3a8a']], node.depth)
    case 'health':
    default:
      return lerpColor(HEALTH_STOPS, node.healthScore)
  }
}

/** Border style hints per node status / ghost. */
export function nodeBorder(node: TreeNode): { color: string; dashed: boolean; width: number } {
  if (!node.isDiscovered) return { color: '#d1d5db', dashed: true, width: 1 }
  const s = node.status
  if (s === null || s >= 500) return { color: '#991b1b', dashed: false, width: 2 }
  if (s >= 400) return { color: '#ef4444', dashed: false, width: 2 }
  if (s >= 300) return { color: '#3b82f6', dashed: true, width: 1.5 }
  if (node.healthScore < 20) return { color: '#ef4444', dashed: false, width: 1.5 }
  if (node.healthScore < 50) return { color: '#f97316', dashed: false, width: 1.5 }
  if (node.healthScore < 80) return { color: '#eab308', dashed: false, width: 1.5 }
  return { color: '#22c55e', dashed: false, width: 1.5 }
}

export function statusDotColor(status: number | null): string {
  if (status === null) return '#9ca3af'
  if (status >= 500) return '#ef4444'
  if (status >= 400) return '#eab308'
  if (status >= 300) return '#3b82f6'
  return '#22c55e'
}

export function toIndentedText(root: TreeNode): string {
  const lines: string[] = []
  const walk = (n: TreeNode, prefix: string, isLast: boolean, isRoot: boolean): void => {
    const branch = isRoot ? '' : isLast ? '└── ' : '├── '
    const score = n.isDiscovered ? ` (Score: ${n.healthScore})` : ' (not crawled)'
    const status = n.status !== null ? ` [${n.status}]` : ''
    const label = isRoot ? n.label : '/' + n.label
    lines.push(`${prefix}${branch}${label}${status}${score}`)
    const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ')
    n.children.forEach((c, i) => walk(c, childPrefix, i === n.children.length - 1, false))
  }
  walk(root, '', true, true)
  return lines.join('\n')
}
