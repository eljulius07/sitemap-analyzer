import { minimatch } from 'minimatch'
import { redirectInfo, type ChangefreqValue, type SitemapAlternate, type SitemapConfig, type UrlResult } from '@shared/types'
import { alternateKey } from '@shared/hreflang'

export interface SitemapFile {
  name: string
  content: string
}
export interface SitemapResult {
  files: SitemapFile[]
  urlCount: number
  warnings: string[]
  isIndex: boolean
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function globMatch(path: string, pattern: string): boolean {
  const p = pattern.trim()
  if (!p) return false
  if (p.endsWith('/*') || p.endsWith('/**')) {
    const prefix = p.replace(/\/\*+$/, '')
    if (path === prefix || path.startsWith(prefix + '/')) return true
  }
  return minimatch(path, p, { nocase: true })
}
function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((p) => globMatch(path, p))
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}
function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

function formatDate(d: Date, format: 'date' | 'datetime'): string {
  if (format === 'date') return d.toISOString().slice(0, 10)
  // W3C datetime with +00:00
  return d.toISOString().replace(/\.\d{3}Z$/, '+00:00')
}

function computeLastmod(r: UrlResult, config: SitemapConfig): string | null {
  switch (config.lastmod) {
    case 'none':
      return null
    case 'custom':
      return config.customLastmod || null
    case 'crawl-date':
      return formatDate(new Date(), config.lastmodFormat)
    case 'header': {
      const h = r.spider?.lastModified || r.http.headers['last-modified'] || ''
      const d = h ? new Date(h) : null
      if (d && !Number.isNaN(d.getTime())) return formatDate(d, config.lastmodFormat)
      return formatDate(new Date(), config.lastmodFormat)
    }
  }
}

/**
 * Depth used for auto priority / changefreq. Spider Mode measures it from the
 * link graph; in Sitemap Mode there is no graph, so fall back to how deep the
 * URL path itself sits — otherwise every URL would score as depth 0.
 */
function depthOf(r: UrlResult): number {
  return r.spider?.depth ?? r.seo?.urlDepth ?? 0
}

function computeChangefreq(r: UrlResult, config: SitemapConfig): ChangefreqValue | null {
  if (config.changefreq === 'none') return null
  if (config.changefreq === 'uniform') return config.uniformChangefreq
  const depth = depthOf(r)
  const map = config.depthChangefreqMap
  if (map[depth] !== undefined) return map[depth]
  const keys = Object.keys(map)
    .map(Number)
    .filter((n) => n <= depth)
    .sort((a, b) => b - a)
  return keys.length ? map[keys[0]] : 'monthly'
}

function computePriority(r: UrlResult, config: SitemapConfig): string | null {
  if (config.priority === 'none') return null
  if (config.priority === 'uniform') return config.uniformPriority.toFixed(1)
  const path = pathOf(r.url)
  for (const ov of config.priorityOverrides) {
    if (globMatch(path, ov.pattern)) return Math.max(0, Math.min(1, ov.priority)).toFixed(1)
  }
  const depth = depthOf(r)
  const inbound = r.spider?.inboundInternal ?? 0
  let p = 1.0 - depth * 0.15
  p += Math.floor(inbound / 10) * 0.1
  p = Math.max(0.1, Math.min(1.0, p))
  return p.toFixed(1)
}

/**
 * Merge alternate sources, first writer per language code wins. With
 * `source: 'both'` that means the page's own tags take precedence and the
 * sitemap only fills in languages the HTML never declared.
 */
function autoAlternates(r: UrlResult, source: SitemapConfig['hreflang']['source']): SitemapAlternate[] {
  const out: SitemapAlternate[] = []
  const seen = new Set<string>()
  const add = (list: SitemapAlternate[]): void => {
    for (const alt of list) {
      const lang = alt.lang.trim().toLowerCase()
      if (!lang || !alt.href || seen.has(lang)) continue
      seen.add(lang)
      out.push(alt)
    }
  }
  if (source !== 'sitemap') add(r.seo?.hreflangLinks ?? [])
  if (source !== 'page') add(r.sitemap?.alternates ?? [])
  return out
}

function hreflangAlternates(r: UrlResult, config: SitemapConfig): SitemapAlternate[] {
  if (!config.hreflang.enabled) return []
  if (config.hreflang.mode === 'auto-detect') {
    return autoAlternates(r, config.hreflang.source)
  }
  // manual-mapping: markers swapped in the URL path
  const mappings = config.hreflang.mappings
  const current = mappings.find((m) => r.url.includes(m.pattern))
  if (!current) return []
  const out: SitemapAlternate[] = []
  for (const m of mappings) {
    out.push({ lang: m.lang, href: r.url.split(current.pattern).join(m.pattern) })
  }
  if (config.hreflang.xDefault) {
    const def = mappings.find((m) => m.lang === config.hreflang.xDefault)
    if (def) out.push({ lang: 'x-default', href: r.url.split(current.pattern).join(def.pattern) })
  }
  return out
}

/** Why a crawled URL did not make it into the generated sitemap. */
type Rejection = 'filtered' | 'status' | 'redirected' | 'non-canonical' | 'duplicate'

export interface SelectionStats {
  status: number
  redirected: number
  nonCanonical: number
  duplicate: number
}

/** The URL a request actually ended on, after following any redirects. */
function destinationOf(r: UrlResult): string {
  return redirectInfo(r.http)?.target ?? r.url
}

function rejectionFor(
  r: UrlResult,
  config: SitemapConfig,
  seenDestinations: Set<string>
): Rejection | null {
  if (r.spider?.isExternal) return 'filtered'

  const code = r.http.statusCode
  // A crawl error or a 4xx/5xx: never worth advertising in a sitemap.
  if (code === null || !config.includeStatuses.includes(code)) return 'status'

  // Redirect chains survive as a 200 (the crawler follows them), so this has
  // to key off the chain rather than the final status code.
  if (config.excludeRedirected && r.http.redirectChain.length > 0) return 'redirected'

  if (config.excludeNonCanonical && r.seo?.canonicalStatus === 'other') return 'non-canonical'

  if (!config.includeNonHtml && r.seo === null) return 'filtered'
  if (!config.includeAll && !config.selectedUrls.includes(r.url)) return 'filtered'
  const path = pathOf(r.url)
  if (config.excludePatterns.length && matchesAny(path, config.excludePatterns)) return 'filtered'
  if (config.includePatterns.length && !matchesAny(path, config.includePatterns)) return 'filtered'

  if (config.excludeDuplicates) {
    const destination = alternateKey(destinationOf(r))
    if (seenDestinations.has(destination)) return 'duplicate'
    seenDestinations.add(destination)
  }

  return null
}

/** Run every result through the exclusion rules, tallying why each was cut. */
export function selectEntries(
  results: UrlResult[],
  config: SitemapConfig
): { included: UrlResult[]; stats: SelectionStats } {
  const stats: SelectionStats = { status: 0, redirected: 0, nonCanonical: 0, duplicate: 0 }
  const seenDestinations = new Set<string>()
  const included: UrlResult[] = []

  for (const r of results) {
    const rejection = rejectionFor(r, config, seenDestinations)
    if (rejection === null) {
      included.push(r)
      continue
    }
    if (rejection === 'status') stats.status++
    else if (rejection === 'redirected') stats.redirected++
    else if (rejection === 'non-canonical') stats.nonCanonical++
    else if (rejection === 'duplicate') stats.duplicate++
  }

  return { included, stats }
}

type AlternateMap = Map<string, SitemapAlternate[]>

/**
 * Resolve the alternates every included URL will advertise, dropping any whose
 * target was excluded — otherwise the fresh sitemap would point hreflang at the
 * very 404s and redirects we just filtered out.
 */
function resolveAlternates(
  included: UrlResult[],
  config: SitemapConfig
): { byUrl: AlternateMap; pruned: number } {
  const byUrl: AlternateMap = new Map()
  if (!config.hreflang.enabled) return { byUrl, pruned: 0 }

  const survivors = new Set(included.map((r) => alternateKey(r.url)))
  let pruned = 0

  for (const r of included) {
    const all = hreflangAlternates(r, config)
    const kept = config.hreflang.pruneExcluded
      ? all.filter((a) => survivors.has(alternateKey(a.href)))
      : all
    pruned += all.length - kept.length
    if (kept.length > 0) byUrl.set(r.url, kept)
  }

  return { byUrl, pruned }
}

function buildUrlEntry(r: UrlResult, config: SitemapConfig, alternates: AlternateMap): string {
  const parts = [`  <url>`, `    <loc>${xmlEscape(r.url)}</loc>`]
  const lastmod = computeLastmod(r, config)
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`)
  const cf = computeChangefreq(r, config)
  if (cf) parts.push(`    <changefreq>${cf}</changefreq>`)
  const pr = computePriority(r, config)
  if (pr) parts.push(`    <priority>${pr}</priority>`)

  for (const alt of alternates.get(r.url) ?? []) {
    parts.push(
      `    <xhtml:link rel="alternate" hreflang="${xmlEscape(alt.lang)}" href="${xmlEscape(alt.href)}"/>`
    )
  }

  if (config.imageSitemap.enabled && r.images) {
    for (const img of r.images.imageUrls.slice(0, config.imageSitemap.maxPerUrl)) {
      parts.push(`    <image:image><image:loc>${xmlEscape(img)}</image:loc></image:image>`)
    }
  }

  if (config.newsSitemap.enabled && matchesAny(pathOf(r.url), config.newsSitemap.urlPatterns)) {
    const date = computeLastmod(r, { ...config, lastmod: 'header', lastmodFormat: 'datetime' }) ?? ''
    parts.push(
      `    <news:news><news:publication><news:name>${xmlEscape(config.newsSitemap.publicationName)}</news:name><news:language>${xmlEscape(config.newsSitemap.language)}</news:language></news:publication>` +
        (date ? `<news:publication_date>${date}</news:publication_date>` : '') +
        `<news:title>${xmlEscape(r.seo?.title ?? '')}</news:title></news:news>`
    )
  }

  parts.push(`  </url>`)
  return parts.join('\n')
}

function namespaces(config: SitemapConfig): string {
  const ns = ['xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"']
  if (config.hreflang.enabled) ns.push('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
  if (config.imageSitemap.enabled) ns.push('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')
  if (config.videoSitemap.enabled) ns.push('xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"')
  if (config.newsSitemap.enabled) ns.push('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"')
  return ns.join('\n        ')
}

function buildUrlsetFile(urls: UrlResult[], config: SitemapConfig, alternates: AlternateMap): string {
  const body = urls.map((r) => buildUrlEntry(r, config, alternates)).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${namespaces(config)}>\n${body}\n</urlset>\n`
}

function buildIndexFile(fileNames: string[], origin: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const entries = fileNames
    .map(
      (name) =>
        `  <sitemap>\n    <loc>${xmlEscape(`${origin}/${name}`)}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`
}

export function generateSitemap(results: UrlResult[], config: SitemapConfig): SitemapResult {
  const { included: eligible, stats } = selectEntries(results, config)
  const { byUrl: alternates, pruned } = resolveAlternates(eligible, config)

  const warnings: string[] = []
  if (eligible.length === 0) warnings.push('No URLs match the current selection.')
  if (stats.status > 0) warnings.push(`${stats.status} URL(s) excluded — error or non-allowed status.`)
  if (stats.redirected > 0) warnings.push(`${stats.redirected} URL(s) excluded — they redirect elsewhere.`)
  if (stats.nonCanonical > 0) warnings.push(`${stats.nonCanonical} URL(s) excluded — canonical points to another URL.`)
  if (stats.duplicate > 0) warnings.push(`${stats.duplicate} duplicate URL(s) collapsed to one entry.`)
  if (pruned > 0) warnings.push(`${pruned} hreflang alternate(s) dropped — target is not in the new sitemap.`)
  const longUrls = eligible.filter((r) => r.url.length > 2048).length
  if (longUrls > 0) warnings.push(`${longUrls} URL(s) exceed 2048 characters.`)

  const baseName = config.filename.replace(/\.xml(\.gz)?$/i, '')

  if (config.format === 'txt') {
    return {
      files: [{ name: `${baseName}.txt`, content: eligible.map((r) => r.url).join('\n') + '\n' }],
      urlCount: eligible.length,
      warnings,
      isIndex: false
    }
  }

  const perFile = Math.max(1, Math.min(config.maxUrlsPerFile, 50000))
  const needsIndex = config.format === 'xml-index' || eligible.length > perFile

  if (!needsIndex) {
    return {
      files: [{ name: `${baseName}.xml`, content: buildUrlsetFile(eligible, config, alternates) }],
      urlCount: eligible.length,
      warnings,
      isIndex: false
    }
  }

  const origin = originOf(eligible[0]?.url ?? config.filename)
  const files: SitemapFile[] = []
  const chunkNames: string[] = []
  for (let i = 0; i < eligible.length; i += perFile) {
    const chunk = eligible.slice(i, i + perFile)
    const name = `${baseName}-${files.length + 1}.xml`
    chunkNames.push(name)
    files.push({ name, content: buildUrlsetFile(chunk, config, alternates) })
  }
  files.unshift({ name: `${baseName}-index.xml`, content: buildIndexFile(chunkNames, origin) })

  return { files, urlCount: eligible.length, warnings, isIndex: true }
}

/** Eligible URL list for the manual selection UI. */
export function eligibleUrls(results: UrlResult[], config: SitemapConfig): UrlResult[] {
  return selectEntries(results, { ...config, includeAll: true }).included
}
