import { writeFile, appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { BrowserWindow, dialog, ipcMain, app } from 'electron'
import { Crawler } from './crawler'
import { Spider } from './spider'
import { parseSitemapFromFile, parseSitemapFromUrl } from './parser'
import {
  DEFAULT_SETTINGS,
  IPC,
  type AnalyzeProgress,
  type CrawlSettings,
  type SpiderConfig,
  type SpiderProgress,
  type StartAnalysisPayload,
  type UrlResult
} from '@shared/types'

let activeCrawler: Crawler | null = null
let activeSpider: Spider | null = null

async function logError(message: string): Promise<void> {
  try {
    const dir = join(app.getPath('userData'), 'logs')
    await mkdir(dir, { recursive: true })
    const line = `[${new Date().toISOString()}] ${message}\n`
    await appendFile(join(dir, 'errors.log'), line, 'utf-8')
  } catch {
    /* logging must never throw */
  }
}

function send(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.pickSitemapFile, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select sitemap',
      properties: ['openFile'],
      filters: [
        { name: 'Sitemaps', extensions: ['xml', 'gz'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(
    IPC.parseSitemapFile,
    async (_e, filePath: string, settings: CrawlSettings = DEFAULT_SETTINGS) => {
      const res = await parseSitemapFromFile(filePath, settings)
      if (res.error) await logError(`parseSitemapFile: ${res.error}`)
      return res
    }
  )

  ipcMain.handle(
    IPC.parseSitemapUrl,
    async (_e, url: string, settings: CrawlSettings = DEFAULT_SETTINGS) => {
      const res = await parseSitemapFromUrl(url, settings)
      if (res.error) await logError(`parseSitemapUrl(${url}): ${res.error}`)
      return res
    }
  )

  ipcMain.handle(IPC.analyzeStart, async (_e, payload: StartAnalysisPayload) => {
    if (activeCrawler) activeCrawler.cancel()

    const { urls, settings } = payload
    const total = urls.length
    const startedAt = Date.now()

    const emitProgress = (currentUrl: string, completed: number, inFlight: number): void => {
      const elapsedMs = Date.now() - startedAt
      const rate = completed > 0 ? completed / elapsedMs : 0
      const remaining = total - completed
      const etaMs = rate > 0 && remaining > 0 ? Math.round(remaining / rate) : null
      const progress: AnalyzeProgress = {
        total,
        completed,
        inFlight,
        currentUrl,
        elapsedMs,
        etaMs
      }
      send(IPC.analyzeProgress, progress)
    }

    const crawler = new Crawler(settings, {
      onResult: (result: UrlResult) => send(IPC.analyzeResult, result),
      onProgress: emitProgress,
      onComplete: (cancelled: boolean) => {
        send(IPC.analyzeComplete, { cancelled })
        if (activeCrawler === crawler) activeCrawler = null
      },
      onError: (message: string) => {
        void logError(`crawl: ${message}`)
        send(IPC.analyzeError, { message })
      }
    })

    activeCrawler = crawler
    // Run detached; progress streams over IPC events.
    void crawler.run(urls)
    return { started: true, total }
  })

  ipcMain.handle(IPC.analyzePause, () => {
    activeCrawler?.pause()
    return { paused: true }
  })

  ipcMain.handle(IPC.analyzeResume, () => {
    activeCrawler?.resume()
    return { resumed: true }
  })

  ipcMain.handle(IPC.analyzeCancel, () => {
    activeCrawler?.cancel()
    return { cancelled: true }
  })

  ipcMain.handle(IPC.spiderStart, async (_e, config: SpiderConfig) => {
    if (activeSpider) activeSpider.cancel()

    const spider = new Spider(config, {
      onPageResult: (result: UrlResult) => send(IPC.spiderPageResult, { result }),
      onProgress: (progress: SpiderProgress) => send(IPC.spiderProgress, progress),
      onComplete: (cancelled: boolean, robotsSitemaps: string[]) => {
        send(IPC.spiderComplete, { cancelled, robotsSitemaps })
        if (activeSpider === spider) activeSpider = null
      },
      onError: (message: string) => {
        void logError(`spider: ${message}`)
        send(IPC.spiderError, { message })
      }
    })

    activeSpider = spider
    void spider.run()
    return { started: true }
  })

  ipcMain.handle(IPC.spiderPause, () => {
    activeSpider?.pause()
    return { paused: true }
  })

  ipcMain.handle(IPC.spiderResume, () => {
    activeSpider?.resume()
    return { resumed: true }
  })

  ipcMain.handle(IPC.spiderCancel, () => {
    activeSpider?.cancel()
    return { cancelled: true }
  })

  ipcMain.handle(
    IPC.exportSave,
    async (
      _e,
      { defaultName, content }: { defaultName: string; content: string }
    ) => {
      const result = await dialog.showSaveDialog({
        title: 'Export',
        defaultPath: defaultName,
        filters: filterFor(defaultName)
      })
      if (result.canceled || !result.filePath) return { saved: false }
      try {
        await writeFile(result.filePath, content, 'utf-8')
        return { saved: true, path: result.filePath }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await logError(`export: ${message}`)
        return { saved: false, error: message }
      }
    }
  )

  ipcMain.handle(
    IPC.exportSaveBinary,
    async (_e, { defaultName, data }: { defaultName: string; data: Uint8Array }) => {
      const result = await dialog.showSaveDialog({
        title: 'Export',
        defaultPath: defaultName,
        filters: filterFor(defaultName)
      })
      if (result.canceled || !result.filePath) return { saved: false }
      try {
        await writeFile(result.filePath, Buffer.from(data))
        return { saved: true, path: result.filePath }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await logError(`exportBinary: ${message}`)
        return { saved: false, error: message }
      }
    }
  )
}

const FILTER_NAMES: Record<string, string> = {
  csv: 'CSV',
  html: 'HTML',
  xml: 'XML Sitemap',
  txt: 'Text',
  json: 'JSON',
  gexf: 'GEXF Graph',
  svg: 'SVG Image',
  png: 'PNG Image',
  xlsx: 'Excel Workbook',
  gz: 'Gzip',
  zip: 'Zip Archive'
}

function filterFor(name: string): { name: string; extensions: string[] }[] {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const label = FILTER_NAMES[ext] ?? 'File'
  return [
    { name: label, extensions: [ext || '*'] },
    { name: 'All Files', extensions: ['*'] }
  ]
}
