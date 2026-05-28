import axios, { type AxiosResponse } from 'axios'
import type { IncomingMessage } from 'node:http'
import type { Readable } from 'node:stream'
import { analyzeHtml } from './analyzer'
import { evaluateResult } from '@shared/scoring'
import type { HttpInfo, RedirectHop, UrlResult } from '@shared/types'

const MAX_REDIRECT_HOPS = 10
const MAX_BODY_BYTES = 5 * 1024 * 1024 // cap body read at 5MB

const HEADER_KEYS = [
  'x-robots-tag',
  'server',
  'x-frame-options',
  'content-security-policy',
  'strict-transport-security',
  'cache-control',
  'etag',
  'content-type',
  'last-modified'
] as const

export interface FetchOpts {
  timeoutMs: number
  userAgent: string
  followRedirects: boolean
}

export interface FetchOutcome {
  http: HttpInfo
  html: string | null
}

export interface FetchPageResult {
  result?: FetchOutcome
  error?: string
  aborted?: boolean
}

function statusText(code: number): string {
  const map: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    410: 'Gone',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  }
  return map[code] ?? ''
}

function readCapped(stream: Readable): Promise<{ text: string; bytes: number }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let bytes = 0
    let stored = 0
    let done = false
    const finish = (): void => {
      if (done) return
      done = true
      resolve({ text: Buffer.concat(chunks).toString('utf-8'), bytes })
    }
    stream.on('data', (chunk: Buffer) => {
      bytes += chunk.length
      if (stored < MAX_BODY_BYTES) {
        chunks.push(chunk)
        stored += chunk.length
      }
      if (bytes >= MAX_BODY_BYTES) {
        stream.destroy()
        finish()
      }
    })
    stream.on('end', finish)
    stream.on('close', finish)
    stream.on('error', (err) => {
      if (!done) {
        done = true
        reject(err)
      }
    })
  })
}

function resolveSafe(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

/** Fetch a single URL, following redirects manually to record the chain + timings. */
export async function fetchPage(
  url: string,
  opts: FetchOpts,
  signal: AbortSignal
): Promise<FetchPageResult> {
  const overallStart = Date.now()
  try {
    const chain: RedirectHop[] = []
    let currentUrl = url
    let redirectTimeMs = 0
    let finalHopStart = overallStart
    let response: AxiosResponse<Readable> | null = null

    for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
      const hopStart = Date.now()
      const res = await axios.get<Readable>(currentUrl, {
        responseType: 'stream',
        maxRedirects: 0,
        timeout: opts.timeoutMs,
        signal,
        decompress: true,
        headers: {
          'User-Agent': opts.userAgent,
          // Mimic a real browser so servers that redirect based on content
          // negotiation (e.g. language) behave the same as in a browser.
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        validateStatus: () => true
      })

      const isRedirect = res.status >= 300 && res.status < 400
      const location = res.headers['location'] as string | undefined

      if (isRedirect && location && opts.followRedirects) {
        redirectTimeMs += Date.now() - hopStart
        chain.push({ url: currentUrl, status: res.status })
        res.data.destroy()
        const next = resolveSafe(location, currentUrl)
        if (!next) {
          response = res
          finalHopStart = hopStart
          break
        }
        currentUrl = next
        continue
      }

      response = res
      finalHopStart = hopStart
      break
    }

    if (!response) return { error: 'Too many redirects' }

    const ttfbMs = Date.now() - finalHopStart
    const status = response.status
    const contentType = String(response.headers['content-type'] ?? '')
    const isHtml = contentType.toLowerCase().includes('text/html')

    let html: string | null = null
    let bytes = 0
    if (isHtml) {
      const body = await readCapped(response.data)
      html = body.text
      bytes = body.bytes
    } else {
      response.data.destroy()
    }
    const totalDownloadMs = Date.now() - finalHopStart

    const rawRes = (response.request as { res?: IncomingMessage } | undefined)?.res
    const rawHeaders = rawRes?.headers ?? {}
    const contentEncoding = String(rawHeaders['content-encoding'] ?? '').toLowerCase()
    const httpVersion = rawRes?.httpVersion ?? '1.1'

    const headers: Record<string, string> = {}
    for (const key of HEADER_KEYS) {
      const v = response.headers[key] ?? rawHeaders[key]
      if (v !== undefined) headers[key] = String(v)
    }

    const headerLength = response.headers['content-length']
    const contentLengthKb =
      headerLength !== undefined
        ? Math.round((Number(headerLength) / 1024) * 100) / 100
        : bytes > 0
          ? Math.round((bytes / 1024) * 100) / 100
          : null

    const http: HttpInfo = {
      statusCode: status,
      statusText: response.statusText || statusText(status),
      redirectChain: chain.length > 0 ? [...chain, { url: currentUrl, status }] : [],
      ttfbMs,
      totalDownloadMs,
      redirectTimeMs,
      contentType,
      contentLengthKb,
      httpVersion,
      compressed: contentEncoding !== '' && contentEncoding !== 'identity',
      headers
    }

    return { result: { http, html: isHtml ? html : null } }
  } catch (err) {
    if (signal.aborted) return { aborted: true }
    if (axios.isAxiosError(err)) {
      return { error: err.code ? `${err.code}: ${err.message}` : err.message }
    }
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export function buildErrorResult(id: number, url: string, error: string): UrlResult {
  const http: HttpInfo = {
    statusCode: null,
    statusText: 'Error',
    redirectChain: [],
    ttfbMs: 0,
    totalDownloadMs: 0,
    redirectTimeMs: 0,
    contentType: '',
    contentLengthKb: null,
    httpVersion: '',
    compressed: false,
    headers: {}
  }
  const base = {
    url,
    http,
    seo: null,
    performance: null,
    content: null,
    technical: null,
    social: null,
    images: null,
    links: null,
    error
  }
  return { id, ...base, ...evaluateResult(base) }
}

export function buildResult(id: number, url: string, outcome: FetchOutcome): UrlResult {
  const { http, html } = outcome
  const analysis = html ? analyzeHtml(html, url, http) : null
  const base = {
    url,
    http,
    seo: analysis?.seo ?? null,
    performance: analysis?.performance ?? null,
    content: analysis?.content ?? null,
    technical: analysis?.technical ?? null,
    social: analysis?.social ?? null,
    images: analysis?.images ?? null,
    links: analysis?.links ?? null,
    error: null
  }
  return { id, ...base, ...evaluateResult(base) }
}
