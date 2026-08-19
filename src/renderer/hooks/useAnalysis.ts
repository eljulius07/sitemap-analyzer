import { useMemo } from 'react'
import { evaluateResult } from '@shared/scoring'
import type { SitemapUrlMeta, UrlResult } from '@shared/types'
import { useStore, type StatusGroup } from '../stores/analysisStore'
import { TAB_FILTERS } from '../results/filters'

function statusGroupOf(code: number | null): StatusGroup {
  if (code === null) return 'errors'
  if (code >= 500) return '5xx'
  if (code >= 400) return '4xx'
  if (code >= 300) return '3xx'
  return '2xx'
}

interface AugmentedEntry {
  duplicateTitle: boolean
  duplicateDescription: boolean
  sitemapMeta: SitemapUrlMeta | undefined
  value: UrlResult
}

/**
 * Per-result cache for the duplicate-aware re-evaluation. `evaluateResult` runs
 * ~40 rules and this hook re-fires on every ingest flush (every 200 ms while a
 * crawl streams in), so uncached a 10k-URL crawl re-scores every row dozens of
 * times. Keyed by the raw result object — the store only ever appends, so those
 * references are stable — and invalidated when either duplicate flag flips.
 * Reusing the entry also keeps row references stable for the virtualized table.
 */
const augmentedCache = new WeakMap<UrlResult, AugmentedEntry>()

/** Re-evaluate every result with cross-URL duplicate context applied. */
export function useAugmentedResults(): UrlResult[] {
  const results = useStore((s) => s.results)
  const sitemapHreflang = useStore((s) => s.sitemapHreflang)
  return useMemo(() => {
    const titleCount = new Map<string, number>()
    const descCount = new Map<string, number>()
    for (const r of results) {
      const t = r.seo?.title.trim().toLowerCase()
      if (t) titleCount.set(t, (titleCount.get(t) ?? 0) + 1)
      const d = r.seo?.metaDescription.trim().toLowerCase()
      if (d) descCount.set(d, (descCount.get(d) ?? 0) + 1)
    }
    return results.map((r) => {
      const t = r.seo?.title.trim().toLowerCase()
      const d = r.seo?.metaDescription.trim().toLowerCase()
      const duplicateTitle = !!t && (titleCount.get(t) ?? 0) > 1
      const duplicateDescription = !!d && (descCount.get(d) ?? 0) > 1

      // The sitemap map is rebuilt only on parse, so this stays a reference
      // compare and the cache survives every ingest flush.
      const sitemapMeta = sitemapHreflang.get(r.url)

      const cached = augmentedCache.get(r)
      if (
        cached &&
        cached.duplicateTitle === duplicateTitle &&
        cached.duplicateDescription === duplicateDescription &&
        cached.sitemapMeta === sitemapMeta
      ) {
        return cached.value
      }

      const value: UrlResult = {
        ...r,
        ...evaluateResult(r, { duplicateTitle, duplicateDescription }),
        ...(sitemapMeta ? { sitemap: sitemapMeta } : {})
      }
      augmentedCache.set(r, { duplicateTitle, duplicateDescription, sitemapMeta, value })
      return value
    })
  }, [results, sitemapHreflang])
}

function matchesSearch(r: UrlResult, q: string): boolean {
  if (!q) return true
  const hay = [
    r.url,
    r.seo?.title ?? '',
    r.seo?.metaDescription ?? '',
    r.seo?.h1 ?? '',
    ...r.issues.map((i) => i.message)
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

export interface ResultsView {
  augmented: UrlResult[]
  /** After global filters only (used for per-tab pill counts). */
  globalFiltered: UrlResult[]
  /** After global + active per-tab pill filters (shown in the table). */
  filtered: UrlResult[]
}

export function useResultsView(): ResultsView {
  const augmented = useAugmentedResults()
  const search = useStore((s) => s.search)
  const statusGroups = useStore((s) => s.statusGroups)
  const severities = useStore((s) => s.severities)
  const healthMin = useStore((s) => s.healthMin)
  const healthMax = useStore((s) => s.healthMax)
  const activeTab = useStore((s) => s.activeTab)
  const tabFilters = useStore((s) => s.tabFilters)
  const activeProblem = useStore((s) => s.activeProblem)
  const imageCacheVersion = useStore((s) => s.imageCacheVersion)

  const globalFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return augmented.filter((r) => {
      if (activeProblem && !activeProblem.urls.has(r.url)) return false
      if (!matchesSearch(r, q)) return false
      if (statusGroups.size > 0 && !statusGroups.has(statusGroupOf(r.http.statusCode))) return false
      if (r.healthScore < healthMin || r.healthScore > healthMax) return false
      if (severities.size > 0) {
        const hasCritical = r.issues.some((i) => i.severity === 'critical')
        const hasWarning = r.issues.some((i) => i.severity === 'warning')
        const hasInfo = r.issues.some((i) => i.severity === 'info')
        const clean = !hasCritical && !hasWarning
        const ok =
          (severities.has('critical') && hasCritical) ||
          (severities.has('warning') && hasWarning) ||
          (severities.has('info') && hasInfo) ||
          (severities.has('none') && clean)
        if (!ok) return false
      }
      return true
    })
  }, [augmented, search, statusGroups, severities, healthMin, healthMax, activeProblem])

  const filtered = useMemo(() => {
    if (tabFilters.size === 0) return globalFiltered
    const active = TAB_FILTERS[activeTab].filter((f) => tabFilters.has(f.id))
    if (active.length === 0) return globalFiltered
    return globalFiltered.filter((r) => active.every((f) => f.test(r)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalFiltered, activeTab, tabFilters, imageCacheVersion])

  return { augmented, globalFiltered, filtered }
}
