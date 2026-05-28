export interface CrawlSettings {
  concurrency: number
  timeoutMs: number
  userAgent: string
  followRedirects: boolean
  retryOnce: boolean
}

export const DEFAULT_SETTINGS: CrawlSettings = {
  concurrency: 10,
  timeoutMs: 15000,
  userAgent:
    'Mozilla/5.0 (compatible; SitemapAnalyzer/1.0; +https://github.com/sitemap-analyzer)',
  followRedirects: true,
  retryOnce: true
}

export type Category =
  | 'seo'
  | 'performance'
  | 'content'
  | 'technical'
  | 'social'
  | 'images'
  | 'links'

export type Severity = 'critical' | 'warning' | 'info'

export interface Issue {
  category: Category
  severity: Severity
  field: string
  message: string
  value: string | number | null
}

export interface RedirectHop {
  url: string
  status: number
}

export interface HttpInfo {
  statusCode: number | null
  statusText: string
  redirectChain: RedirectHop[]
  /** Time to first byte of the final response (ms). */
  ttfbMs: number
  /** Time from final request start to full body received (ms). */
  totalDownloadMs: number
  /** Total time spent following redirects (ms). */
  redirectTimeMs: number
  contentType: string
  contentLengthKb: number | null
  /** HTTP protocol version reported by the response (e.g. "1.1", "2.0"). */
  httpVersion: string
  /** Whether the response body was compressed (gzip/br/deflate). */
  compressed: boolean
  /** Selected response headers (lower-cased keys). */
  headers: Record<string, string>
}

/**
 * If the page was reached through one or more HTTP redirects, return the
 * triggering redirect status (e.g. 301/302) and the final destination URL.
 */
export function redirectInfo(http: HttpInfo): { status: number; target: string } | null {
  const chain = http.redirectChain
  if (chain.length === 0) return null
  const hop = chain.find((h) => h.status >= 300 && h.status < 400)
  return { status: hop?.status ?? chain[0].status, target: chain[chain.length - 1].url }
}

export type CanonicalStatus = 'self' | 'other' | 'missing'

export interface SeoAnalysis {
  title: string
  titleLength: number
  titlePixelWidth: number
  titleHasBrand: boolean
  metaDescription: string
  metaDescriptionLength: number
  h1: string
  h1Count: number
  h2Count: number
  h3Count: number
  headingHierarchyValid: boolean
  metaRobots: string
  xRobotsTag: string
  canonicalUrl: string
  canonicalStatus: CanonicalStatus
  isIndexable: boolean
  urlLength: number
  urlDepth: number
  hasUppercase: boolean
  hasUnderscores: boolean
  hasParameters: boolean
  htmlLang: string
  hreflang: string[]
  hreflangLinks: { lang: string; href: string }[]
  hreflangCount: number
  hreflangSelfReference: boolean
}

export interface PerformanceAnalysis {
  ttfbMs: number
  totalDownloadMs: number
  redirectTimeMs: number
  numRedirects: number
  htmlSizeKb: number
  totalPageWeightKb: number
  htmlCompressed: boolean
  jsFilesCount: number
  cssFilesCount: number
  imageCount: number
  fontPreloads: number
  inlineScriptCount: number
  inlineStyleCount: number
  jsFileUrls: string[]
  cssFileUrls: string[]
  renderBlockingJs: string[]
  renderBlockingCss: string[]
  hasLazyLoading: boolean
  hasPreconnect: boolean
  hasDnsPrefetch: boolean
  hasResourceHints: boolean
  renderBlockingCount: number
}

export interface ContentAnalysis {
  wordCount: number
  textHtmlRatio: number
  readingLevel: number
  paragraphCount: number
  hasTable: boolean
  hasVideo: boolean
  hasAudio: boolean
  hasIframe: boolean
  iframeDomains: string[]
  contentLanguage: string
}

export interface TechnicalAnalysis {
  https: boolean
  http2: boolean
  hasDoctype: boolean
  hasCharset: boolean
  hasViewport: boolean
  hasFavicon: boolean
  hasSitemapReference: boolean
  contentTypeHeader: string
  serverHeader: string
  xFrameOptions: string
  contentSecurityPolicy: string
  strictTransportSecurity: string
  cacheControl: string
  etag: string
}

export interface SocialAnalysis {
  ogTitle: string
  ogDescription: string
  ogImage: string
  ogImageWidth: string
  ogImageHeight: string
  ogType: string
  ogUrl: string
  ogComplete: boolean
  twitterCard: string
  twitterTitle: string
  twitterDescription: string
  twitterImage: string
  hasStructuredData: boolean
  schemaTypes: string[]
  schemaCount: number
  hasBreadcrumb: boolean
  hasFaq: boolean
  hasArticle: boolean
  hasProduct: boolean
  hasLocalBusiness: boolean
  jsonLdValid: boolean
  rawJsonLd: string[]
}

export interface ImageAnalysis {
  totalImages: number
  missingAlt: number
  emptyAlt: number
  missingDimensions: number
  nextGenFormats: number
  legacyFormats: number
  lazyLoaded: number
  withSrcset: number
  imageUrls: string[]
}

export interface LinkAnalysis {
  totalLinks: number
  internalLinks: number
  externalLinks: number
  nofollow: number
  sponsored: number
  ugc: number
  withoutAnchorText: number
  hashOnly: number
  javascriptLinks: number
  externalDomains: string[]
}

export interface CategoryScores {
  seo: number
  performance: number
  content: number
  technical: number
  social: number
  images: number
}

/** Relative weights applied to category scores to form the health score. */
export const HEALTH_WEIGHTS: CategoryScores = {
  seo: 0.35,
  performance: 0.25,
  content: 0.15,
  technical: 0.1,
  social: 0.1,
  images: 0.05
}

export type RowStatus = 'ok' | 'warning' | 'error'

export interface SpiderMeta {
  depth: number
  discoveredFrom: string
  /** Normalized internal URLs found on this page. */
  internalLinks: string[]
  /** External (off-domain) URLs found on this page. */
  externalLinks: string[]
  isExternal: boolean
  /** Last-Modified response header, if any. */
  lastModified: string
  // Derived once the full crawl is known (filled in renderer):
  inboundInternal: number
  outboundInternal: number
  outboundExternal: number
  parents: string[]
  isOrphan: boolean
  isDeadEnd: boolean
  pathGroup: string
}

export interface UrlResult {
  id: number
  url: string
  http: HttpInfo
  healthScore: number
  scores: CategoryScores
  seo: SeoAnalysis | null
  performance: PerformanceAnalysis | null
  content: ContentAnalysis | null
  technical: TechnicalAnalysis | null
  social: SocialAnalysis | null
  images: ImageAnalysis | null
  links: LinkAnalysis | null
  issues: Issue[]
  rowStatus: RowStatus
  error: string | null
  /** Present only for pages discovered via Spider Mode. */
  spider?: SpiderMeta
}

export interface AnalyzeProgress {
  total: number
  completed: number
  inFlight: number
  currentUrl: string
  elapsedMs: number
  etaMs: number | null
}

export interface ParseSitemapResult {
  urls: string[]
  sitemapCount: number
  error?: string
}

export interface StartAnalysisPayload {
  urls: string[]
  settings: CrawlSettings
}

export type CrawlState = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled'

/** Channel names shared between main and renderer. */
export const IPC = {
  parseSitemapFile: 'sitemap:parse-file',
  parseSitemapUrl: 'sitemap:parse-url',
  pickSitemapFile: 'sitemap:pick-file',
  analyzeStart: 'analyze:start',
  analyzePause: 'analyze:pause',
  analyzeResume: 'analyze:resume',
  analyzeCancel: 'analyze:cancel',
  analyzeProgress: 'analyze:progress',
  analyzeResult: 'analyze:result',
  analyzeComplete: 'analyze:complete',
  analyzeError: 'analyze:error',
  exportSave: 'export:save',
  exportSaveBinary: 'export:save-binary',
  spiderStart: 'spider:start',
  spiderPause: 'spider:pause',
  spiderResume: 'spider:resume',
  spiderCancel: 'spider:cancel',
  spiderProgress: 'spider:progress',
  spiderPageResult: 'spider:page-result',
  spiderComplete: 'spider:complete',
  spiderError: 'spider:error'
} as const

export interface SpiderConfig {
  startUrl: string
  maxDepth: number
  maxPages: number
  concurrency: number
  timeoutMs: number
  userAgent: string
  respectRobotsTxt: boolean
  followSubdomains: boolean
  crawlQueryParams: boolean
  includeExternal: boolean
  includePatterns: string[]
  excludePatterns: string[]
}

export const DEFAULT_SPIDER_CONFIG: SpiderConfig = {
  startUrl: '',
  maxDepth: 5,
  maxPages: 500,
  concurrency: 10,
  timeoutMs: 15000,
  userAgent: DEFAULT_SETTINGS.userAgent,
  respectRobotsTxt: true,
  followSubdomains: false,
  crawlQueryParams: false,
  includeExternal: false,
  includePatterns: [],
  excludePatterns: []
}

export interface SpiderProgress {
  status: 'crawling' | 'paused' | 'complete' | 'cancelled'
  crawled: number
  discovered: number
  queued: number
  maxPages: number
  depthCounts: number[]
  currentUrls: string[]
  status2xx: number
  status3xx: number
  status4xx: number
  status5xx: number
  errors: number
  totalLinks: number
  elapsedMs: number
  etaMs: number | null
  pagesPerSec: number
}

export interface SpiderPageEvent {
  result: UrlResult
}

export interface SpiderCompleteEvent {
  cancelled: boolean
  robotsSitemaps: string[]
}

export interface GraphNode {
  id: string
  url: string
  depth: number
  status: number | null
  healthScore: number
  pageTitle: string
  type: 'page' | 'external' | 'error' | 'redirect'
  inDegree: number
  outDegree: number
  group: string
}

export interface GraphEdge {
  source: string
  target: string
  type: 'internal' | 'external'
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  metadata: {
    rootUrl: string
    crawlDate: string
    totalNodes: number
    totalEdges: number
    maxDepth: number
    avgDepth: number
    internalCount: number
    externalCount: number
    mostLinked: { url: string; inDegree: number } | null
    orphans: number
    deadEnds: number
  }
}

export type ChangefreqValue =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never'

export interface SitemapConfig {
  format: 'xml' | 'xml-index' | 'txt'
  maxUrlsPerFile: number
  includeStatuses: number[]
  includeNonHtml: boolean
  includeAll: boolean
  selectedUrls: string[]
  includePatterns: string[]
  excludePatterns: string[]
  lastmod: 'header' | 'crawl-date' | 'custom' | 'none'
  customLastmod: string
  lastmodFormat: 'date' | 'datetime'
  changefreq: 'auto-by-depth' | 'uniform' | 'none'
  uniformChangefreq: ChangefreqValue
  depthChangefreqMap: Record<number, ChangefreqValue>
  priority: 'auto-calculate' | 'uniform' | 'none'
  uniformPriority: number
  priorityOverrides: { pattern: string; priority: number }[]
  hreflang: {
    enabled: boolean
    mode: 'auto-detect' | 'manual-mapping'
    mappings: { lang: string; pattern: string; replacement: string }[]
    xDefault: string
  }
  imageSitemap: { enabled: boolean; maxPerUrl: number }
  videoSitemap: { enabled: boolean }
  newsSitemap: {
    enabled: boolean
    urlPatterns: string[]
    publicationName: string
    language: string
  }
  filename: string
  compress: boolean
}

export const DEFAULT_SITEMAP_CONFIG: SitemapConfig = {
  format: 'xml',
  maxUrlsPerFile: 50000,
  includeStatuses: [200],
  includeNonHtml: false,
  includeAll: true,
  selectedUrls: [],
  includePatterns: [],
  excludePatterns: [],
  lastmod: 'crawl-date',
  customLastmod: '',
  lastmodFormat: 'date',
  changefreq: 'auto-by-depth',
  uniformChangefreq: 'monthly',
  depthChangefreqMap: { 0: 'daily', 1: 'weekly', 2: 'weekly', 3: 'monthly' },
  priority: 'auto-calculate',
  uniformPriority: 0.5,
  priorityOverrides: [],
  hreflang: { enabled: false, mode: 'auto-detect', mappings: [], xDefault: '' },
  imageSitemap: { enabled: false, maxPerUrl: 100 },
  videoSitemap: { enabled: false },
  newsSitemap: { enabled: false, urlPatterns: [], publicationName: '', language: 'en' },
  filename: 'sitemap.xml',
  compress: false
}
