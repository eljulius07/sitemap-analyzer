import { buildErrorResult, buildResult, fetchPage, type FetchPageResult } from './fetcher'
import type { CrawlSettings, UrlResult } from '@shared/types'

interface CrawlCallbacks {
  onResult: (result: UrlResult) => void
  onProgress: (currentUrl: string, completed: number, inFlight: number) => void
  onComplete: (cancelled: boolean) => void
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

export class Crawler {
  private settings: CrawlSettings
  private callbacks: CrawlCallbacks
  private cancelled = false
  private paused = false
  private resumeGate: Deferred | null = null
  private completed = 0
  private inFlight = 0
  private abortControllers = new Set<AbortController>()

  constructor(settings: CrawlSettings, callbacks: CrawlCallbacks) {
    this.settings = settings
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
    for (const ctrl of this.abortControllers) ctrl.abort()
  }

  private async waitIfPaused(): Promise<void> {
    while (this.paused && !this.cancelled) {
      await this.resumeGate?.promise
    }
  }

  async run(urls: string[]): Promise<void> {
    try {
      const queue = urls.map((url, index) => ({ url, id: index }))
      let cursor = 0
      const workerCount = Math.max(1, Math.min(this.settings.concurrency, 50))

      const worker = async (): Promise<void> => {
        while (true) {
          if (this.cancelled) return
          await this.waitIfPaused()
          if (this.cancelled) return
          const job = queue[cursor++]
          if (!job) return

          this.inFlight++
          this.callbacks.onProgress(job.url, this.completed, this.inFlight)
          const result = await this.crawlOne(job.url, job.id)
          this.inFlight--
          this.completed++

          if (!this.cancelled) {
            this.callbacks.onResult(result)
            this.callbacks.onProgress(job.url, this.completed, this.inFlight)
          }
        }
      }

      const workers = Array.from({ length: workerCount }, () => worker())
      await Promise.all(workers)
      this.callbacks.onComplete(this.cancelled)
    } catch (err) {
      this.callbacks.onError(err instanceof Error ? err.message : String(err))
      this.callbacks.onComplete(this.cancelled)
    }
  }

  private async crawlOne(url: string, id: number): Promise<UrlResult> {
    let outcome = await this.tryFetch(url)
    if (
      outcome.error &&
      this.settings.retryOnce &&
      !this.cancelled &&
      !outcome.aborted
    ) {
      outcome = await this.tryFetch(url)
    }

    if (outcome.aborted) {
      return buildErrorResult(id, url, this.cancelled ? 'Cancelled' : 'Timeout')
    }
    if (outcome.error) return buildErrorResult(id, url, outcome.error)
    return buildResult(id, url, outcome.result!)
  }

  private async tryFetch(url: string): Promise<FetchPageResult> {
    const controller = new AbortController()
    this.abortControllers.add(controller)
    const timer = setTimeout(() => controller.abort(), this.settings.timeoutMs)
    try {
      return await fetchPage(
        url,
        {
          timeoutMs: this.settings.timeoutMs,
          userAgent: this.settings.userAgent,
          followRedirects: this.settings.followRedirects
        },
        controller.signal
      )
    } finally {
      clearTimeout(timer)
      this.abortControllers.delete(controller)
    }
  }
}
