import type { SitemapConfig } from '@shared/types'

type Hreflang = SitemapConfig['hreflang']

export function HreflangConfig({
  value,
  onChange
}: {
  value: Hreflang
  onChange: (h: Hreflang) => void
}): JSX.Element {
  const update = (patch: Partial<Hreflang>): void => onChange({ ...value, ...patch })

  const setMapping = (i: number, patch: Partial<Hreflang['mappings'][number]>): void => {
    const mappings = value.mappings.map((m, idx) => (idx === i ? { ...m, ...patch } : m))
    update({ mappings })
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      <label className="flex items-center justify-between text-sm font-medium">
        Alternate language tags (hreflang)
        <input type="checkbox" checked={value.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
      </label>

      {value.enabled && (
        <div className="mt-3 space-y-3">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={value.mode === 'auto-detect'} onChange={() => update({ mode: 'auto-detect' })} />
              Auto-detect from page tags
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={value.mode === 'manual-mapping'} onChange={() => update({ mode: 'manual-mapping' })} />
              Manual mapping
            </label>
          </div>

          {value.mode === 'manual-mapping' && (
            <div className="space-y-2">
              <div className="text-xs text-slate-500">
                Each language has a path marker (e.g. <code>/es/</code>). The generator swaps the
                marker to build alternate URLs.
              </div>
              {value.mappings.map((m, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={m.lang}
                    onChange={(e) => setMapping(i, { lang: e.target.value })}
                    placeholder="lang (es)"
                    className="w-24 px-2 py-1 rounded border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-900"
                  />
                  <input
                    value={m.pattern}
                    onChange={(e) => setMapping(i, { pattern: e.target.value })}
                    placeholder="marker (/es/)"
                    className="flex-1 px-2 py-1 rounded border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-900"
                  />
                  <button
                    onClick={() => update({ mappings: value.mappings.filter((_, idx) => idx !== i) })}
                    className="text-rose-500 text-sm px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => update({ mappings: [...value.mappings, { lang: '', pattern: '', replacement: '' }] })}
                className="text-xs text-brand-500"
              >
                + Add language
              </button>
              <label className="flex items-center gap-2 text-sm mt-2">
                x-default lang:
                <input
                  value={value.xDefault}
                  onChange={(e) => update({ xDefault: e.target.value })}
                  placeholder="en"
                  className="w-24 px-2 py-1 rounded border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
            </div>
          )}
          {value.mode === 'auto-detect' && (
            <div className="text-xs text-slate-500">
              Uses the <code>&lt;link rel="alternate" hreflang&gt;</code> tags found on each crawled page.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
