import type { GraphData, GraphEdge, GraphNode, UrlResult } from '@shared/types'
import { pathGroupOf } from './url'

function nodeType(r: UrlResult): GraphNode['type'] {
  const code = r.http.statusCode
  if (code === null || code >= 400) return 'error'
  if (code >= 300 || r.http.redirectChain.length > 0) return 'redirect'
  return 'page'
}

export interface FinalizeResult {
  results: UrlResult[]
  graph: GraphData
}

/**
 * Build graph data from spider page results and backfill derived spider
 * metrics (inbound links, parents, orphan / dead-end flags) onto each result.
 */
export function buildGraph(
  results: UrlResult[],
  rootUrl: string,
  includeExternal: boolean
): FinalizeResult {
  const known = new Set(results.map((r) => r.url))

  // Aggregate inbound edges.
  const inbound = new Map<string, Set<string>>()
  const edges: GraphEdge[] = []
  const externalTargets = new Set<string>()

  for (const r of results) {
    const internal = r.spider?.internalLinks ?? []
    for (const target of internal) {
      if (target === r.url) continue
      if (!known.has(target)) continue
      edges.push({ source: r.url, target, type: 'internal' })
      if (!inbound.has(target)) inbound.set(target, new Set())
      inbound.get(target)!.add(r.url)
    }
    if (includeExternal) {
      for (const ext of r.spider?.externalLinks ?? []) {
        externalTargets.add(ext)
        edges.push({ source: r.url, target: ext, type: 'external' })
      }
    }
  }

  const nodes: GraphNode[] = []
  const finalized: UrlResult[] = results.map((r) => {
    const parents = [...(inbound.get(r.url) ?? [])]
    const inDegree = parents.length
    const depth = r.spider?.depth ?? 0
    const outboundInternal = r.spider?.outboundInternal ?? (r.spider?.internalLinks.length ?? 0)
    const isOrphan = inDegree === 0 && depth !== 0
    const isDeadEnd = outboundInternal === 0

    nodes.push({
      id: r.url,
      url: r.url,
      depth,
      status: r.http.statusCode,
      healthScore: r.healthScore,
      pageTitle: r.seo?.title ?? '',
      type: nodeType(r),
      inDegree,
      outDegree: outboundInternal,
      group: r.spider?.pathGroup ?? pathGroupOf(r.url)
    })

    if (!r.spider) return r
    return {
      ...r,
      spider: { ...r.spider, inboundInternal: inDegree, parents, isOrphan, isDeadEnd }
    }
  })

  if (includeExternal) {
    for (const ext of externalTargets) {
      nodes.push({
        id: ext,
        url: ext,
        depth: -1,
        status: null,
        healthScore: 0,
        pageTitle: '',
        type: 'external',
        inDegree: 0,
        outDegree: 0,
        group: 'external'
      })
    }
  }

  const internalNodes = nodes.filter((n) => n.type !== 'external')
  const depthSum = internalNodes.reduce((s, n) => s + Math.max(0, n.depth), 0)
  const maxDepth = internalNodes.reduce((m, n) => Math.max(m, n.depth), 0)
  let mostLinked: GraphData['metadata']['mostLinked'] = null
  for (const n of internalNodes) {
    if (!mostLinked || n.inDegree > mostLinked.inDegree) {
      mostLinked = { url: n.url, inDegree: n.inDegree }
    }
  }
  const orphans = internalNodes.filter((n) => n.inDegree === 0 && n.depth !== 0).length
  const deadEnds = finalized.filter((r) => r.spider?.isDeadEnd).length

  const graph: GraphData = {
    nodes,
    edges,
    metadata: {
      rootUrl,
      crawlDate: new Date().toISOString(),
      totalNodes: nodes.length,
      totalEdges: edges.length,
      maxDepth,
      avgDepth: internalNodes.length ? Math.round((depthSum / internalNodes.length) * 10) / 10 : 0,
      internalCount: internalNodes.length,
      externalCount: nodes.length - internalNodes.length,
      mostLinked,
      orphans,
      deadEnds
    }
  }

  return { results: finalized, graph }
}
