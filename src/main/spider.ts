import * as cheerio from 'cheerio'
import { minimatch } from 'minimatch'
import { buildErrorResult, buildResult, fetchPage } from './fetcher'
import { fetchRobots, type RobotsRules } from './robots-parser'
import { hostOf, isInternal, normalizeUrl, pathGroupOf } from './url-normalizer'
import type { SpiderConfig, SpiderMeta, SpiderProgress, UrlResult } from '@shared/types'

interface SpiderCallbacks {
  onPageResult: (result: UrlResult) => void
  onProgress: (progress: SpiderProgress) => void
  onComplete: (cancelled: boolean, robotsSitemaps: string[]) => void
  onError: (message: string) => void
}

interface Deferred {
  promise: Promise<void>
  resolve: () => void
}
function createDeferred(): Deferred {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Match a path against a glob pattern, treating a trailing /* as a prefix. */
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

function extractLinks(
  html: string,
  baseUrl: string,
  rootHost: string,
  config: SpiderConfig
): { internal: string[]; external: string[] } {
  const $ = cheerio.load(html)
  const internal = new Set<string>()
  const external = new Set<string>()
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    const norm = normalizeUrl(href, baseUrl, config.crawlQueryParams)
    if (!norm) return
    if (isInternal(norm, rootHost, config.followSubdomains)) internal.add(norm)
    else external.add(norm)
  })
  return { internal: [...internal], external: [...external] }
}

export class Spider {
  private config: SpiderConfig
  private callbacks: SpiderCallbacks
  private cancelled = false
  private paused = false
  private resumeGate: Deferred | null = null
  private abortControllers = new Set<AbortController>()

  private rootHost = ''
  private robots: RobotsRules = { isAllowed: () => true, crawlDelayMs: 0, sitemaps: [] }
  private discovered = new Map<string, { depth: number; from: string }>()
  private queue: { url: string; depth: number }[] = []
  private cursor = 0
  private active = new Set<string>()
  private idCounter = 0
  private crawled = 0
  private totalLinks = 0
  private startTime = 0
  private lastRequestStart = 0
  private depthCounts: number[] = []
  private status2xx = 0
  private status3xx = 0
  private status4xx = 0
  private status5xx = 0
  private errors = 0

  constructor(config: SpiderConfig, callbacks: SpiderCallbacks) {
    this.config = config
    this.callbacks = callbacks
  }

  pause(): void {
    if (this.paused || this.cancelled) return
    this.paused = true
    this.resumeGate = createDeferred()
  }
  resume(): void {
    if (!this.paused) return
    this.paused = false
    this.resumeGate?.resolve()
    this.resumeGate = null
  }
  cancel(): void {
    this.cancelled = true
    if (this.paused) this.resume()
    for (const c of this.abortControllers) c.abort()
  }
  private async waitIfPaused(): Promise<void> {
    while (this.paused && !this.cancelled) await this.resumeGate?.promise
  }

  async run(): Promise<void> {
    try {
      const start = normalizeUrl(this.config.startUrl, this.config.startUrl, this.config.crawlQueryParams)
      if (!start) {
        this.callbacks.onError('Invalid start URL')
        this.callbacks.onComplete(false, [])
        return
      }
      this.rootHost = hostOf(start)
      this.startTime = Date.now()

      if (this.config.respectRobotsTxt) {
        this.robots = await fetchRobots(start, this.config.userAgent, this.config.timeoutMs)
      }

      this.discovered.set(start, { depth: 0, from: '' })
      this.queue.push({ url: start, depth: 0 })

      const workerCount = Math.max(1, Math.min(this.config.concurrency, 50))
      const workers = Array.from({ length: workerCount }, () => this.worker())
      await Promise.all(workers)
      this.callbacks.onComplete(this.cancelled, this.robots.sitemaps)
    } catch (err) {
      this.callbacks.onError(err instanceof Error ? err.message : String(err))
      this.callbacks.onComplete(this.cancelled, this.robots.sitemaps)
    }
  }

  private async worker(): Promise<void> {
    while (true) {
      if (this.cancelled) return
      await this.waitIfPaused()
      if (this.cancelled) return

      const job = this.queue[this.cursor]
      if (!job) {
        if (this.active.size === 0) return
        await sleep(20)
        continue
      }
      this.cursor++
      this.active.add(job.url)
      try {
        await this.processOne(job.url, job.depth)
      } catch (err) {
        this.callbacks.onError(err instanceof Error ? err.message : String(err))
      } finally {
        this.active.delete(job.url)
      }
    }
  }

  private shouldCrawl(url: string): boolean {
    let path = '/'
    try {
      path = new URL(url).pathname
    } catch {
      return false
    }
    if (this.config.excludePatterns.length && matchesAny(path, this.config.excludePatterns)) return false
    if (this.config.includePatterns.length && !matchesAny(path, this.config.includePatterns)) return false
    if (this.config.respectRobotsTxt && !this.robots.isAllowed(url)) return false
    return true
  }

  private async throttle(): Promise<void> {
    if (this.robots.crawlDelayMs <= 0) return
    const wait = this.robots.crawlDelayMs - (Date.now() - this.lastRequestStart)
    if (wait > 0) await sleep(wait)
    this.lastRequestStart = Date.now()
  }

  private async processOne(url: string, depth: number): Promise<void> {
    // Root is always crawled; others respect robots/patterns.
    if (depth > 0 && !this.shouldCrawl(url)) return

    await this.throttle()
    if (this.cancelled) return

    const controller = new AbortController()
    this.abortControllers.add(controller)
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)
    let outcome
    try {
      outcome = await fetchPage(
        url,
        { timeoutMs: this.config.timeoutMs, userAgent: this.config.userAgent, followRedirects: true },
        controller.signal
      )
    } finally {
      clearTimeout(timer)
      this.abortControllers.delete(controller)
    }
    if (this.cancelled) return

    const id = this.idCounter++
    let result: UrlResult
    let internal: string[] = []
    let external: string[] = []

    if (outcome.aborted) {
      result = buildErrorResult(id, url, 'Timeout')
    } else if (outcome.error) {
      result = buildErrorResult(id, url, outcome.error)
    } else {
      const fetched = outcome.result!
      result = buildResult(id, url, fetched)
      if (fetched.html) {
        const links = extractLinks(fetched.html, url, this.rootHost, this.config)
        internal = links.internal
        external = links.external
      }
    }

    this.totalLinks += internal.length + external.length
    this.tallyStatus(result.http.statusCode)
    this.crawled++
    this.depthCounts[depth] = (this.depthCounts[depth] ?? 0) + 1

    const spider: SpiderMeta = {
      depth,
      discoveredFrom: this.discovered.get(url)?.from ?? '',
      internalLinks: internal,
      externalLinks: external,
      isExternal: false,
      lastModified: result.http.headers['last-modified'] ?? '',
      inboundInternal: 0,
      outboundInternal: internal.length,
      outboundExternal: external.length,
      parents: [],
      isOrphan: false,
      isDeadEnd: internal.length === 0,
      pathGroup: pathGroupOf(url)
    }
    result.spider = spider

    this.callbacks.onPageResult(result)

    // Enqueue newly discovered internal links.
    if (depth + 1 <= this.config.maxDepth) {
      for (const link of internal) {
        if (this.discovered.size >= this.config.maxPages) break
        if (this.discovered.has(link)) continue
        this.discovered.set(link, { depth: depth + 1, from: url })
        this.queue.push({ url: link, depth: depth + 1 })
      }
    }

    this.emitProgress()
  }

  private tallyStatus(code: number | null): void {
    if (code === null) this.errors++
    else if (code >= 500) this.status5xx++
    else if (code >= 400) this.status4xx++
    else if (code >= 300) this.status3xx++
    else this.status2xx++
  }

  private emitProgress(): void {
    const elapsedMs = Date.now() - this.startTime
    const pagesPerSec = elapsedMs > 0 ? this.crawled / (elapsedMs / 1000) : 0
    const remaining = Math.min(this.discovered.size, this.config.maxPages) - this.crawled
    const etaMs = pagesPerSec > 0 && remaining > 0 ? Math.round((remaining / pagesPerSec) * 1000) : null
    this.callbacks.onProgress({
      status: this.cancelled ? 'cancelled' : this.paused ? 'paused' : 'crawling',
      crawled: this.crawled,
      discovered: this.discovered.size,
      queued: Math.max(0, this.queue.length - this.cursor),
      maxPages: this.config.maxPages,
      depthCounts: [...this.depthCounts].map((n) => n ?? 0),
      currentUrls: [...this.active].slice(0, 5),
      status2xx: this.status2xx,
      status3xx: this.status3xx,
      status4xx: this.status4xx,
      status5xx: this.status5xx,
      errors: this.errors,
      totalLinks: this.totalLinks,
      elapsedMs,
      etaMs,
      pagesPerSec: Math.round(pagesPerSec * 10) / 10
    })
  }
}
