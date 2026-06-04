import type { ImageInspection } from '@shared/types'

/**
 * Module-level cache for image-inspection results, keyed by page URL.
 * Lives for the renderer session — avoids re-fetching when reopening the
 * detail panel for the same URL.
 */
const cache = new Map<string, ImageInspection[]>()
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((l) => l())
}

export function getCachedInspection(pageUrl: string): ImageInspection[] | null {
  return cache.get(pageUrl) ?? null
}

export function setCachedInspection(pageUrl: string, data: ImageInspection[]): void {
  cache.set(pageUrl, data)
  notify()
}

export function clearInspectionCache(): void {
  cache.clear()
  notify()
}

/** Subscribe to any cache change. Returns an unsubscribe function. */
export function subscribeInspection(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Whether the given page has at least one inspected image >= thresholdKb. */
export function hasHeavyImage(pageUrl: string, thresholdKb = 100): boolean {
  const list = cache.get(pageUrl)
  if (!list) return false
  return list.some((i) => (i.sizeKb ?? 0) >= thresholdKb)
}

export function isInspected(pageUrl: string): boolean {
  return cache.has(pageUrl)
}
