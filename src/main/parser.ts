import { gunzipSync } from 'node:zlib'
import { readFile } from 'node:fs/promises'
import axios from 'axios'
import { XMLParser } from 'fast-xml-parser'
import type {
  CrawlSettings,
  ParseSitemapResult,
  SitemapAlternate,
  SitemapUrlEntry
} from '@shared/types'

const MAX_NESTED_SITEMAPS = 50

/**
 * Element names that carry hreflang alternates inside a `<url>`. The protocol
 * spells it `xhtml:link`, but plenty of real sitemaps emit a bare `link`.
 */
const ALTERNATE_KEYS = ['xhtml:link', 'link'] as const

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  isArray: (name) => name === 'url' || name === 'sitemap' || name === 'xhtml:link' || name === 'link'
})

/** Coerce fast-xml-parser output into an array regardless of single/multi. */
function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

/** A gzip member starts with the magic bytes 0x1f 0x8b. */
function looksGzipped(buf: Buffer, url?: string): boolean {
  if (url?.toLowerCase().endsWith('.gz')) return true
  return buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b
}

function decode(buf: Buffer, url?: string): string {
  const data = looksGzipped(buf, url) ? gunzipSync(buf) : buf
  return data.toString('utf-8')
}

interface AlternateNode {
  '@_rel'?: string
  '@_hreflang'?: string
  '@_href'?: string
}
interface UrlEntry {
  loc?: string
  'xhtml:link'?: AlternateNode[]
  link?: AlternateNode[]
}
interface SitemapEntry {
  loc?: string
}

/**
 * Collect the hreflang alternates declared inside one `<url>`. A link with no
 * `rel` is accepted (some generators omit it); anything with a different `rel`
 * — stylesheet, canonical — is skipped.
 */
function readAlternates(entry: UrlEntry): SitemapAlternate[] {
  const out: SitemapAlternate[] = []
  const seen = new Set<string>()
  for (const key of ALTERNATE_KEYS) {
    for (const node of toArray<AlternateNode>(entry[key])) {
      const rel = node?.['@_rel']?.trim().toLowerCase()
      if (rel && rel !== 'alternate') continue
      const lang = node?.['@_hreflang']?.trim() ?? ''
      const href = node?.['@_href']?.trim() ?? ''
      if (!lang || !href) continue
      const dedupe = `${lang}\u0000${href}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      out.push({ lang, href })
    }
  }
  return out
}

/**
 * Parse a single sitemap document. Returns either page entries (urlset) or
 * nested sitemap locations (sitemapindex).
 */
function parseDocument(xml: string): { entries: SitemapUrlEntry[]; nested: string[] } {
  const parsed = xmlParser.parse(xml)
  const entries: SitemapUrlEntry[] = []
  const nested: string[] = []

  if (parsed?.urlset) {
    for (const entry of toArray<UrlEntry>(parsed.urlset.url)) {
      const loc = typeof entry?.loc === 'string' ? entry.loc.trim() : ''
      if (loc) entries.push({ loc, alternates: readAlternates(entry) })
    }
  }

  if (parsed?.sitemapindex) {
    for (const entry of toArray<SitemapEntry>(parsed.sitemapindex.sitemap)) {
      const loc = typeof entry?.loc === 'string' ? entry.loc.trim() : ''
      if (loc) nested.push(loc)
    }
  }

  return { entries, nested }
}

interface Collector {
  /** Unique entries keyed by `<loc>`, in first-seen order. */
  byLoc: Map<string, SitemapUrlEntry>
  /** How many `<loc>` values were seen more than once. */
  duplicates: number
}

/** Merge a document's entries into the collector, folding duplicate locs. */
function collect(target: Collector, entries: SitemapUrlEntry[]): void {
  for (const entry of entries) {
    const existing = target.byLoc.get(entry.loc)
    if (!existing) {
      target.byLoc.set(entry.loc, entry)
      continue
    }
    target.duplicates++
    // Keep the first entry, but absorb alternates only the duplicate declared.
    for (const alt of entry.alternates) {
      if (!existing.alternates.some((a) => a.lang === alt.lang && a.href === alt.href)) {
        existing.alternates.push(alt)
      }
    }
  }
}

function emptyResult(error: string): ParseSitemapResult {
  return { urls: [], sitemapCount: 0, entries: [], duplicateLocs: 0, error }
}

function finish(target: Collector, sitemapCount: number): ParseSitemapResult {
  const entries = [...target.byLoc.values()]
  return {
    urls: entries.map((e) => e.loc),
    sitemapCount,
    entries,
    duplicateLocs: target.duplicates
  }
}

function isValidXml(xml: string): boolean {
  const trimmed = xml.trimStart()
  return (
    trimmed.includes('<urlset') ||
    trimmed.includes('<sitemapindex') ||
    trimmed.startsWith('<?xml')
  )
}

async function fetchSitemap(url: string, settings: CrawlSettings): Promise<Buffer> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: settings.timeoutMs,
    maxRedirects: 5,
    headers: { 'User-Agent': settings.userAgent },
    validateStatus: (s) => s >= 200 && s < 400
  })
  return Buffer.from(res.data)
}

/**
 * Recursively resolve a sitemap (index files supported). Each nested sitemap is
 * fetched over the network. De-duplicates URLs and guards against cycles.
 */
async function resolveRemote(
  url: string,
  settings: CrawlSettings,
  seen: Set<string>,
  collected: Collector,
  counter: { sitemaps: number }
): Promise<void> {
  if (seen.has(url) || counter.sitemaps >= MAX_NESTED_SITEMAPS) return
  seen.add(url)
  counter.sitemaps++

  const buf = await fetchSitemap(url, settings)
  const xml = decode(buf, url)
  if (!isValidXml(xml)) throw new Error(`Invalid sitemap XML at ${url}`)

  const { entries, nested } = parseDocument(xml)
  collect(collected, entries)
  for (const child of nested) {
    await resolveRemote(child, settings, seen, collected, counter)
  }
}

export async function parseSitemapFromUrl(
  url: string,
  settings: CrawlSettings
): Promise<ParseSitemapResult> {
  try {
    const seen = new Set<string>()
    const collected: Collector = { byLoc: new Map(), duplicates: 0 }
    const counter = { sitemaps: 0 }
    await resolveRemote(url, settings, seen, collected, counter)
    return finish(collected, counter.sitemaps)
  } catch (err) {
    return emptyResult(err instanceof Error ? err.message : String(err))
  }
}

/**
 * Parse a sitemap from a local file. Nested sitemap *index* entries that point
 * to remote URLs are fetched; local-only parsing still works for plain urlsets.
 */
export async function parseSitemapFromFile(
  filePath: string,
  settings: CrawlSettings
): Promise<ParseSitemapResult> {
  try {
    const buf = await readFile(filePath)
    const xml = decode(buf, filePath)
    if (!isValidXml(xml)) return emptyResult('File is not a valid XML sitemap.')

    const { entries, nested } = parseDocument(xml)
    const collected: Collector = { byLoc: new Map(), duplicates: 0 }
    collect(collected, entries)
    const counter = { sitemaps: 1 }

    if (nested.length > 0) {
      const seen = new Set<string>()
      for (const child of nested) {
        await resolveRemote(child, settings, seen, collected, counter)
      }
    }

    return finish(collected, counter.sitemaps)
  } catch (err) {
    return emptyResult(err instanceof Error ? err.message : String(err))
  }
}
