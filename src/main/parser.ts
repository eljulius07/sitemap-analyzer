import { gunzipSync } from 'node:zlib'
import { readFile } from 'node:fs/promises'
import axios from 'axios'
import { XMLParser } from 'fast-xml-parser'
import type { CrawlSettings, ParseSitemapResult } from '@shared/types'

const MAX_NESTED_SITEMAPS = 50

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  isArray: (name) => name === 'url' || name === 'sitemap'
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

interface UrlEntry {
  loc?: string
}
interface SitemapEntry {
  loc?: string
}

/**
 * Parse a single sitemap document. Returns either page URLs (urlset) or
 * nested sitemap locations (sitemapindex).
 */
function parseDocument(xml: string): { urls: string[]; nested: string[] } {
  const parsed = xmlParser.parse(xml)
  const urls: string[] = []
  const nested: string[] = []

  if (parsed?.urlset) {
    for (const entry of toArray<UrlEntry>(parsed.urlset.url)) {
      const loc = typeof entry?.loc === 'string' ? entry.loc.trim() : ''
      if (loc) urls.push(loc)
    }
  }

  if (parsed?.sitemapindex) {
    for (const entry of toArray<SitemapEntry>(parsed.sitemapindex.sitemap)) {
      const loc = typeof entry?.loc === 'string' ? entry.loc.trim() : ''
      if (loc) nested.push(loc)
    }
  }

  return { urls, nested }
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
  collected: Set<string>,
  counter: { sitemaps: number }
): Promise<void> {
  if (seen.has(url) || counter.sitemaps >= MAX_NESTED_SITEMAPS) return
  seen.add(url)
  counter.sitemaps++

  const buf = await fetchSitemap(url, settings)
  const xml = decode(buf, url)
  if (!isValidXml(xml)) throw new Error(`Invalid sitemap XML at ${url}`)

  const { urls, nested } = parseDocument(xml)
  for (const u of urls) collected.add(u)
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
    const collected = new Set<string>()
    const counter = { sitemaps: 0 }
    await resolveRemote(url, settings, seen, collected, counter)
    return { urls: [...collected], sitemapCount: counter.sitemaps }
  } catch (err) {
    return {
      urls: [],
      sitemapCount: 0,
      error: err instanceof Error ? err.message : String(err)
    }
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
    if (!isValidXml(xml)) {
      return { urls: [], sitemapCount: 0, error: 'File is not a valid XML sitemap.' }
    }

    const { urls, nested } = parseDocument(xml)
    const collected = new Set<string>(urls)
    const counter = { sitemaps: 1 }

    if (nested.length > 0) {
      const seen = new Set<string>()
      for (const child of nested) {
        await resolveRemote(child, settings, seen, collected, counter)
      }
    }

    return { urls: [...collected], sitemapCount: counter.sitemaps }
  } catch (err) {
    return {
      urls: [],
      sitemapCount: 0,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}
