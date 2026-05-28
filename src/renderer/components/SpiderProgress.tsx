import { useSpiderStore } from '../stores/spiderStore'
import { formatDuration } from '../utils/format'
import { GraphMiniPreview } from './GraphMiniPreview'

export function SpiderProgress(): JSX.Element {
  const progress = useSpiderStore((s) => s.progress)
  const paused = useSpiderStore((s) => s.paused)
  const config = useSpiderStore((s) => s.config)
  const pageResults = useSpiderStore((s) => s.pageResults)
  const pause = useSpiderStore((s) => s.pause)
  const resume = useSpiderStore((s) => s.resume)
  const cancel = useSpiderStore((s) => s.cancel)

  const crawled = progress?.crawled ?? 0
  const total = progress ? Math.min(progress.discovered, progress.maxPages) : config.maxPages
  const pct = total > 0 ? Math.round((crawled / total) * 100) : 0

  const Stat = ({ label, value }: { label: string; value: string | number }): JSX.Element => (
    <span>
      {label}: <span className="font-semibold">{value}</span>
    </span>
  )

  return (
    <div className="w-full max-w-3xl">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🕷️</span>
          <span className="font-semibold truncate">Crawling: {config.startUrl}</span>
        </div>

        <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-1">
          <div className="h-full bg-brand-600 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-sm text-slate-500 mb-4">
          {crawled.toLocaleString()} / {total.toLocaleString()} pages ({pct}%)
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {(progress?.depthCounts ?? []).map((count, depth) => (
            <div key={depth} className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-900 text-xs">
              <div className="text-slate-400">Depth {depth}</div>
              <div className="font-semibold text-sm">{count} pages</div>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <div className="flex-1 text-xs text-slate-500 space-y-1.5">
            <div className="text-slate-400">Currently crawling:</div>
            {(progress?.currentUrls ?? []).slice(0, 3).map((u, i) => (
              <div key={i} className="truncate text-slate-600 dark:text-slate-300">→ {u}</div>
            ))}
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2">
              <Stat label="2xx" value={progress?.status2xx ?? 0} />
              <Stat label="3xx" value={progress?.status3xx ?? 0} />
              <Stat label="4xx" value={progress?.status4xx ?? 0} />
              <Stat label="5xx" value={progress?.status5xx ?? 0} />
              <Stat label="Errors" value={progress?.errors ?? 0} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <Stat label="Elapsed" value={formatDuration(progress?.elapsedMs ?? 0)} />
              {progress?.etaMs != null && <Stat label="ETA" value={`~${formatDuration(progress.etaMs)}`} />}
              <Stat label="Rate" value={`${progress?.pagesPerSec ?? 0}/s`} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <Stat label="Links found" value={(progress?.totalLinks ?? 0).toLocaleString()} />
              <Stat label="Queue" value={(progress?.queued ?? 0).toLocaleString()} />
            </div>
          </div>
          <GraphMiniPreview results={pageResults} />
        </div>

        <div className="flex gap-2 mt-5">
          {paused ? (
            <button onClick={resume} className="px-4 py-2 rounded-md text-sm font-medium bg-brand-600 text-white hover:bg-brand-700">▶️ Resume</button>
          ) : (
            <button onClick={pause} className="px-4 py-2 rounded-md text-sm font-medium border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700">⏸️ Pause</button>
          )}
          <button onClick={cancel} className="px-4 py-2 rounded-md text-sm font-medium bg-amber-600 text-white hover:bg-amber-700">⏹️ Stop &amp; Show Results</button>
          <button onClick={cancel} className="px-4 py-2 rounded-md text-sm font-medium bg-rose-600 text-white hover:bg-rose-700">❌ Cancel</button>
        </div>
      </div>
    </div>
  )
}
