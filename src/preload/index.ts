import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC,
  type AnalyzeProgress,
  type CrawlSettings,
  type ParseSitemapResult,
  type SpiderCompleteEvent,
  type SpiderConfig,
  type SpiderPageEvent,
  type SpiderProgress,
  type StartAnalysisPayload,
  type UrlResult
} from '../shared/types'

type Unsubscribe = () => void

function on<T>(channel: string, cb: (payload: T) => void): Unsubscribe {
  const listener = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  pickSitemapFile: (): Promise<string | null> => ipcRenderer.invoke(IPC.pickSitemapFile),

  parseSitemapFile: (filePath: string, settings: CrawlSettings): Promise<ParseSitemapResult> =>
    ipcRenderer.invoke(IPC.parseSitemapFile, filePath, settings),

  parseSitemapUrl: (url: string, settings: CrawlSettings): Promise<ParseSitemapResult> =>
    ipcRenderer.invoke(IPC.parseSitemapUrl, url, settings),

  startAnalysis: (payload: StartAnalysisPayload): Promise<{ started: boolean; total: number }> =>
    ipcRenderer.invoke(IPC.analyzeStart, payload),

  pauseAnalysis: (): Promise<unknown> => ipcRenderer.invoke(IPC.analyzePause),
  resumeAnalysis: (): Promise<unknown> => ipcRenderer.invoke(IPC.analyzeResume),
  cancelAnalysis: (): Promise<unknown> => ipcRenderer.invoke(IPC.analyzeCancel),

  saveExport: (
    defaultName: string,
    content: string
  ): Promise<{ saved: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke(IPC.exportSave, { defaultName, content }),

  saveExportBinary: (
    defaultName: string,
    data: Uint8Array
  ): Promise<{ saved: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke(IPC.exportSaveBinary, { defaultName, data }),

  onProgress: (cb: (p: AnalyzeProgress) => void): Unsubscribe =>
    on<AnalyzeProgress>(IPC.analyzeProgress, cb),
  onResult: (cb: (r: UrlResult) => void): Unsubscribe => on<UrlResult>(IPC.analyzeResult, cb),
  onComplete: (cb: (p: { cancelled: boolean }) => void): Unsubscribe =>
    on<{ cancelled: boolean }>(IPC.analyzeComplete, cb),
  onError: (cb: (p: { message: string }) => void): Unsubscribe =>
    on<{ message: string }>(IPC.analyzeError, cb),

  // ---- Spider Mode ----
  startSpider: (config: SpiderConfig): Promise<{ started: boolean }> =>
    ipcRenderer.invoke(IPC.spiderStart, config),
  pauseSpider: (): Promise<unknown> => ipcRenderer.invoke(IPC.spiderPause),
  resumeSpider: (): Promise<unknown> => ipcRenderer.invoke(IPC.spiderResume),
  cancelSpider: (): Promise<unknown> => ipcRenderer.invoke(IPC.spiderCancel),

  onSpiderProgress: (cb: (p: SpiderProgress) => void): Unsubscribe =>
    on<SpiderProgress>(IPC.spiderProgress, cb),
  onSpiderPageResult: (cb: (p: SpiderPageEvent) => void): Unsubscribe =>
    on<SpiderPageEvent>(IPC.spiderPageResult, cb),
  onSpiderComplete: (cb: (p: SpiderCompleteEvent) => void): Unsubscribe =>
    on<SpiderCompleteEvent>(IPC.spiderComplete, cb),
  onSpiderError: (cb: (p: { message: string }) => void): Unsubscribe =>
    on<{ message: string }>(IPC.spiderError, cb)
}

contextBridge.exposeInMainWorld('api', api)

export type SitemapApi = typeof api
