import { useSpiderStore } from '../stores/spiderStore'
import { formatDuration } from '../utils/format'
import { GraphMiniPreview } from './GraphMiniPreview'

function shortUrl(u: string): string {
  return u.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
}

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
    <span className="whitespace-nowrap">
      {label}: <span className="font-semibold">{value}</span>
    </span>
  )

  return (
    <div className="w-full max-w-3xl">
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
        {/* Header: full width */}
        <div className="px-5 pt-5 pb-3 min-w-0">
          <div className="flex items-center gap-2 mb-3 min-w-0">
            <span className="text-xl shrink-0">🕷️</span>
            <span className="font-semibold truncate min-w-0" title={config.startUrl}>
              Crawling: {config.startUrl}
            </span>
          </div>
          <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-brand-600 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-sm text-slate-500 mt-1 tabular-nums">
            {crawled.toLocaleString()} / {total.toLocaleString()} pages ({pct}%)
          </div>
        </div>

        {/* Body: fixed two-column grid (graph never moves) */}
        <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-4 px-5 pb-4 items-start">
          {/* Left column — fluid, must allow shrink below content */}
          <div className="min-w-0 overflow-hidden flex flex-col gap-3">
            {/* Depth badges */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(progress?.depthCounts ?? []).map((count, depth) => (
                <div
                  key={depth}
                  className="shrink-0 min-w-[80px] px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-900 text-xs text-center"
                >
                  <div className="text-slate-400">Depth {depth}</div>
                  <div className="font-semibold text-sm tabular-nums">{count} pages</div>
                </div>
              ))}
            </div>

            {/* Currently crawling list */}
            <div className="min-w-0">
              <div className="text-xs text-slate-400 mb-1">Currently crawling:</div>
              <div className="space-y-0.5">
                {(progress?.currentUrls ?? []).slice(0, 3).map((u, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 min-w-0 text-xs text-slate-600 dark:text-slate-300"
                    title={u}
                  >
                    <span className="shrink-0 text-slate-400">→</span>
                    <span className="min-w-0 flex-1 truncate font-mono">{shortUrl(u)}</span>
                  </div>
                ))}
                {(!progress || progress.currentUrls.length === 0) && (
                  <div className="text-xs text-slate-400 italic">waiting…</div>
                )}
              </div>
            </div>

            {/* Stats — tabular-nums keeps widths stable as numbers change */}
            <div className="space-y-1 text-xs text-slate-500 tabular-nums">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <Stat label="2xx" value={progress?.status2xx ?? 0} />
                <Stat label="3xx" value={progress?.status3xx ?? 0} />
                <Stat label="4xx" value={progress?.status4xx ?? 0} />
                <Stat label="5xx" value={progress?.status5xx ?? 0} />
                <Stat label="Errors" value={progress?.errors ?? 0} />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <Stat label="Elapsed" value={formatDuration(progress?.elapsedMs ?? 0)} />
                {progress?.etaMs != null && (
                  <Stat label="ETA" value={`~${formatDuration(progress.etaMs)}`} />
                )}
                <Stat label="Rate" value={`${progress?.pagesPerSec ?? 0}/s`} />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <Stat label="Links found" value={(progress?.totalLinks ?? 0).toLocaleString()} />
                <Stat label="Queue" value={(progress?.queued ?? 0).toLocaleString()} />
              </div>
            </div>
          </div>

          {/* Right column — fixed width, graph never shifts */}
          <div className="w-[220px] shrink-0 flex justify-center">
            <div className="w-[200px] h-[200px] shrink-0">
              <GraphMiniPreview results={pageResults} />
            </div>
          </div>
        </div>

        {/* Footer: actions, full width */}
        <div className="flex gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
          {paused ? (
            <button onClick={resume} className="px-4 py-2 rounded-md text-sm font-medium bg-brand-600 text-white hover:bg-brand-700">
              ▶️ Resume
            </button>
          ) : (
            <button onClick={pause} className="px-4 py-2 rounded-md text-sm font-medium border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700">
              ⏸️ Pause
            </button>
          )}
          <button onClick={cancel} className="px-4 py-2 rounded-md text-sm font-medium bg-amber-600 text-white hover:bg-amber-700">
            ⏹️ Stop &amp; Show Results
          </button>
          <button onClick={cancel} className="px-4 py-2 rounded-md text-sm font-medium bg-rose-600 text-white hover:bg-rose-700">
            ❌ Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
