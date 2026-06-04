import axios from 'axios'
import { imageSize } from 'image-size'
import type { ImageInspection } from '@shared/types'

const RANGE_BYTES = 32768 // 32 KB — enough for headers of jpg/png/webp/avif/gif/svg
const ABS_MAX_BYTES = 5 * 1024 * 1024 // hard cap if the server ignores Range
const DEFAULT_TIMEOUT = 8000
const DEFAULT_CONCURRENCY = 5

export interface InspectOpts {
  userAgent?: string
  timeoutMs?: number
  concurrency?: number
}

function isHttp(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

async function inspectOne(url: string, opts: Required<InspectOpts>, signal: AbortSignal): Promise<ImageInspection> {
  if (!isHttp(url)) {
    return { url, sizeKb: null, width: null, height: null, error: 'not an http(s) URL' }
  }
  try {
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: opts.timeoutMs,
      signal,
      maxContentLength: ABS_MAX_BYTES,
      maxBodyLength: ABS_MAX_BYTES,
      decompress: true,
      headers: {
        'User-Agent': opts.userAgent,
        Range: `bytes=0-${RANGE_BYTES - 1}`,
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      validateStatus: (s) => s >= 200 && s < 400
    })

    // Total size: Content-Range (when 206) or Content-Length (when 200, full file).
    let sizeBytes: number | null = null
    if (res.status === 206) {
      const range = res.headers['content-range']
      if (typeof range === 'string') {
        const total = range.split('/')[1]
        if (total && total !== '*') {
          const n = Number(total)
          if (Number.isFinite(n)) sizeBytes = n
        }
      }
    }
    if (sizeBytes === null) {
      const len = res.headers['content-length']
      if (len !== undefined) {
        const n = Number(len)
        if (Number.isFinite(n)) sizeBytes = n
      }
    }
    if (sizeBytes === null) sizeBytes = (res.data as ArrayBuffer).byteLength

    let width: number | null = null
    let height: number | null = null
    try {
      const dims = imageSize(Buffer.from(res.data as ArrayBuffer))
      if (typeof dims.width === 'number') width = dims.width
      if (typeof dims.height === 'number') height = dims.height
    } catch {
      /* unsupported format or insufficient bytes; leave nulls */
    }

    return {
      url,
      sizeKb: sizeBytes !== null ? Math.round((sizeBytes / 1024) * 10) / 10 : null,
      width,
      height
    }
  } catch (err) {
    const message = axios.isAxiosError(err)
      ? err.code
        ? `${err.code}: ${err.message}`
        : err.message
      : err instanceof Error
        ? err.message
        : String(err)
    return { url, sizeKb: null, width: null, height: null, error: message }
  }
}

/**
 * Probe a list of image URLs in parallel (bounded concurrency) and return
 * per-image weight + intrinsic dimensions. Failures are returned in-band.
 */
export async function inspectImages(urls: string[], opts: InspectOpts = {}): Promise<ImageInspection[]> {
  const merged: Required<InspectOpts> = {
    userAgent: opts.userAgent ?? 'Mozilla/5.0 SiteAnalyzer image-inspector',
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT,
    concurrency: Math.max(1, Math.min(opts.concurrency ?? DEFAULT_CONCURRENCY, 10))
  }
  // Dedupe URLs while preserving order.
  const seen = new Set<string>()
  const list = urls.filter((u) => {
    if (!u || seen.has(u)) return false
    seen.add(u)
    return true
  })

  const results = new Map<string, ImageInspection>()
  let cursor = 0
  const worker = async (): Promise<void> => {
    while (true) {
      const url = list[cursor++]
      if (!url) return
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), merged.timeoutMs)
      try {
        results.set(url, await inspectOne(url, merged, controller.signal))
      } finally {
        clearTimeout(timer)
      }
    }
  }
  await Promise.all(Array.from({ length: merged.concurrency }, worker))
  return list.map((u) => results.get(u) ?? { url: u, sizeKb: null, width: null, height: null, error: 'no result' })
}
