import { useStore } from '../stores/analysisStore'
import { formatDuration } from '../utils/format'

export function ProgressBar(): JSX.Element | null {
  const progress = useStore((s) => s.progress)
  const crawlState = useStore((s) => s.crawlState)
  const pause = useStore((s) => s.pause)
  const resume = useStore((s) => s.resume)
  const cancel = useStore((s) => s.cancel)

  if (!progress) return null

  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
  const paused = crawlState === 'paused'

  return (
    <div className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">
          {paused ? 'Paused' : 'Analyzing'} — {progress.completed.toLocaleString()} /{' '}
          {progress.total.toLocaleString()} ({pct}%)
        </div>
        <div className="flex gap-2">
          {paused ? (
            <button
              onClick={resume}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-brand-600 text-white hover:bg-brand-700"
            >
              Resume
            </button>
          ) : (
            <button
              onClick={pause}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              Pause
            </button>
          )}
          <button
            onClick={cancel}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-rose-600 text-white hover:bg-rose-700"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="h-2 rounded-full bg-slate-200 overflow-hidden dark:bg-slate-800">
        <div
          className="h-full bg-brand-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
        <span className="truncate max-w-[60%]" title={progress.currentUrl}>
          {progress.inFlight} in flight · {progress.currentUrl || 'starting…'}
        </span>
        <span>
          Elapsed {formatDuration(progress.elapsedMs)}
          {progress.etaMs !== null && ` · ETA ${formatDuration(progress.etaMs)}`}
        </span>
      </div>
    </div>
  )
}
