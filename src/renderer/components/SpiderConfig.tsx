import { useSpiderStore } from '../stores/spiderStore'

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}): JSX.Element {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm">
        {label}
        {hint && <span className="text-xs text-slate-500 ml-1">{hint}</span>}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          onChange(Number.isNaN(n) ? min : Math.min(max, Math.max(min, n)))
        }}
        className="w-24 px-2 py-1 rounded-md border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-800"
      />
    </label>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}): JSX.Element {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
      <span className="text-sm">
        {label}
        {hint && <span className="text-xs text-slate-500 ml-1">{hint}</span>}
      </span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
          checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </label>
  )
}

export function SpiderConfig(): JSX.Element {
  const config = useSpiderStore((s) => s.config)
  const updateConfig = useSpiderStore((s) => s.updateConfig)
  const start = useSpiderStore((s) => s.start)

  const setList = (key: 'includePatterns' | 'excludePatterns', value: string): void =>
    updateConfig({ [key]: value.split(',').map((s) => s.trim()).filter(Boolean) } as never)

  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🕷️</span>
        <h2 className="text-xl font-bold">Spider Mode</h2>
      </div>

      <label className="block mb-4">
        <span className="text-sm font-medium">Start URL</span>
        <input
          type="url"
          value={config.startUrl}
          onChange={(e) => updateConfig({ startUrl: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && config.startUrl.trim() && void start()}
          placeholder="https://example.com"
          className="mt-1 w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800"
        />
      </label>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="text-sm font-semibold mb-2">Crawl Settings</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 divide-y divide-slate-100 dark:divide-slate-700/50 md:divide-y-0">
          <div className="md:divide-y md:divide-slate-100 md:dark:divide-slate-700/50">
            <NumberField label="Max Depth" hint="(1–10)" value={config.maxDepth} min={1} max={10} onChange={(v) => updateConfig({ maxDepth: v })} />
            <NumberField label="Max Pages" hint="(10–10000)" value={config.maxPages} min={10} max={10000} step={10} onChange={(v) => updateConfig({ maxPages: v })} />
            <NumberField label="Concurrency" hint="(1–50)" value={config.concurrency} min={1} max={50} onChange={(v) => updateConfig({ concurrency: v })} />
            <NumberField label="Timeout (ms)" value={config.timeoutMs} min={1000} max={120000} step={1000} onChange={(v) => updateConfig({ timeoutMs: v })} />
          </div>
          <div className="md:divide-y md:divide-slate-100 md:dark:divide-slate-700/50">
            <Toggle label="Respect robots.txt" checked={config.respectRobotsTxt} onChange={(v) => updateConfig({ respectRobotsTxt: v })} />
            <Toggle label="Follow subdomains" checked={config.followSubdomains} onChange={(v) => updateConfig({ followSubdomains: v })} />
            <Toggle label="Crawl query params" hint="treat ?a=1 as unique" checked={config.crawlQueryParams} onChange={(v) => updateConfig({ crawlQueryParams: v })} />
            <Toggle label="Include external" hint="discover, don't crawl" checked={config.includeExternal} onChange={(v) => updateConfig({ includeExternal: v })} />
          </div>
        </div>

        <label className="block mt-3">
          <span className="text-xs text-slate-500">URL Pattern Include (comma-separated globs)</span>
          <input
            type="text"
            defaultValue={config.includePatterns.join(', ')}
            onBlur={(e) => setList('includePatterns', e.target.value)}
            placeholder="/blog/*"
            className="mt-1 w-full px-3 py-1.5 rounded-md border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </label>
        <label className="block mt-2">
          <span className="text-xs text-slate-500">URL Pattern Exclude</span>
          <input
            type="text"
            defaultValue={config.excludePatterns.join(', ')}
            onBlur={(e) => setList('excludePatterns', e.target.value)}
            placeholder="/admin/*, /api/*"
            className="mt-1 w-full px-3 py-1.5 rounded-md border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </label>
      </div>

      <button
        onClick={() => void start()}
        disabled={!config.startUrl.trim()}
        className="mt-5 w-full px-5 py-3 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50"
      >
        🚀 Start Crawling
      </button>
    </div>
  )
}
