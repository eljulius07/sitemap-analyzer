import { useMemo, useState } from 'react'
import JSZip from 'jszip'
import {
  DEFAULT_SITEMAP_CONFIG,
  type ChangefreqValue,
  type SitemapConfig,
  type UrlResult
} from '@shared/types'
import { useStore } from '../stores/analysisStore'
import { eligibleUrls, generateSitemap, type SitemapResult } from '../utils/sitemap-generator'
import { HreflangConfig } from './HreflangConfig'
import { SitemapPreview } from './SitemapPreview'

const FREQ: ChangefreqValue[] = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      <div className="text-sm font-semibold mb-2">{title}</div>
      {children}
    </div>
  )
}

async function gzip(text: string): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  const cs = new CompressionStream('gzip')
  const stream = new Blob([text]).stream().pipeThrough(cs)
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

export function SitemapGenerator({ results }: { results: UrlResult[] }): JSX.Element {
  const pushToast = useStore((s) => s.pushToast)
  const [config, setConfig] = useState<SitemapConfig>({ ...DEFAULT_SITEMAP_CONFIG })
  const [preview, setPreview] = useState<SitemapResult | null>(null)

  const update = (patch: Partial<SitemapConfig>): void => setConfig((c) => ({ ...c, ...patch }))

  const eligible = useMemo(() => eligibleUrls(results, config), [results, config])
  const [search, setSearch] = useState('')
  const shownManual = useMemo(
    () => eligible.filter((r) => r.url.toLowerCase().includes(search.toLowerCase())).slice(0, 300),
    [eligible, search]
  )

  const toggleUrl = (url: string): void => {
    const set = new Set(config.selectedUrls)
    set.has(url) ? set.delete(url) : set.add(url)
    update({ selectedUrls: [...set] })
  }

  const doPreview = (): void => setPreview(generateSitemap(results, config))

  const doExport = async (): Promise<void> => {
    const result = generateSitemap(results, config)
    setPreview(result)
    if (result.urlCount === 0) {
      pushToast('error', 'No URLs to export.')
      return
    }
    try {
      if (result.files.length > 1) {
        const zip = new JSZip()
        result.files.forEach((f) => zip.file(f.name, f.content))
        const bytes = await zip.generateAsync({ type: 'uint8array' })
        const res = await window.api.saveExportBinary('sitemaps.zip', bytes)
        if (res.saved) pushToast('success', `Saved ${res.path}`)
      } else {
        const f = result.files[0]
        if (config.compress) {
          const bytes = await gzip(f.content)
          if (!bytes) {
            pushToast('error', 'Compression unavailable in this environment.')
            return
          }
          const res = await window.api.saveExportBinary(`${f.name}.gz`, bytes)
          if (res.saved) pushToast('success', `Saved ${res.path}`)
        } else {
          const res = await window.api.saveExport(f.name, f.content)
          if (res.saved) pushToast('success', `Saved ${res.path}`)
        }
      }
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : String(e))
    }
  }

  const depthFreq = (depth: number): ChangefreqValue => config.depthChangefreqMap[depth] ?? 'monthly'
  const setDepthFreq = (depth: number, v: ChangefreqValue): void =>
    update({ depthChangefreqMap: { ...config.depthChangefreqMap, [depth]: v } })

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">📝</span>
        <h2 className="text-lg font-bold">Sitemap Generator</h2>
      </div>

      <Section title="General">
        <div className="flex gap-4 text-sm mb-2">
          {(['xml', 'xml-index', 'txt'] as const).map((f) => (
            <label key={f} className="flex items-center gap-1.5">
              <input type="radio" checked={config.format === f} onChange={() => update({ format: f })} />
              {f === 'xml' ? 'XML' : f === 'xml-index' ? 'XML + Index' : 'TXT'}
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          Max URLs/file:
          <input
            type="number"
            min={1}
            max={50000}
            value={config.maxUrlsPerFile}
            onChange={(e) => update({ maxUrlsPerFile: Number(e.target.value) || 50000 })}
            className="w-28 px-2 py-1 rounded border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </label>
        <div className="flex gap-4 text-sm mt-2">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={config.includeStatuses.includes(301)}
              onChange={(e) => update({ includeStatuses: e.target.checked ? [200, 301] : [200] })}
            />
            Include 301 targets
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={config.includeNonHtml} onChange={(e) => update({ includeNonHtml: e.target.checked })} />
            Include non-HTML
          </label>
        </div>
      </Section>

      <Section title="URL Selection">
        <div className="flex gap-4 text-sm mb-2">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={config.includeAll} onChange={() => update({ includeAll: true })} />
            Include all ({eligible.length})
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={!config.includeAll} onChange={() => update({ includeAll: false, selectedUrls: eligible.map((r) => r.url) })} />
            Manual selection
          </label>
        </div>
        {!config.includeAll && (
          <div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter URLs…"
              className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-900 mb-2"
            />
            <div className="max-h-44 overflow-auto border border-slate-200 dark:border-slate-700 rounded">
              {shownManual.map((r) => (
                <label key={r.url} className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input type="checkbox" checked={config.selectedUrls.includes(r.url)} onChange={() => toggleUrl(r.url)} />
                  <span className="truncate">{r.url}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <input
            defaultValue={config.includePatterns.join(', ')}
            onBlur={(e) => update({ includePatterns: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            placeholder="Include /blog/*"
            className="px-2 py-1 rounded border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-900"
          />
          <input
            defaultValue={config.excludePatterns.join(', ')}
            onBlur={(e) => update({ excludePatterns: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            placeholder="Exclude /tag/*"
            className="px-2 py-1 rounded border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Section title="<lastmod>">
          {(['header', 'crawl-date', 'custom', 'none'] as const).map((m) => (
            <label key={m} className="flex items-center gap-1.5 text-sm">
              <input type="radio" checked={config.lastmod === m} onChange={() => update({ lastmod: m })} />
              {m === 'header' ? 'Last-Modified header' : m === 'crawl-date' ? 'Crawl date' : m === 'custom' ? 'Custom' : 'None'}
            </label>
          ))}
          {config.lastmod === 'custom' && (
            <input type="date" value={config.customLastmod} onChange={(e) => update({ customLastmod: e.target.value })} className="mt-1 px-2 py-1 rounded border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-900" />
          )}
          <select value={config.lastmodFormat} onChange={(e) => update({ lastmodFormat: e.target.value as 'date' | 'datetime' })} className="mt-2 w-full px-2 py-1 rounded border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-900">
            <option value="date">W3C Date</option>
            <option value="datetime">W3C DateTime</option>
          </select>
        </Section>

        <Section title="<changefreq>">
          {(['auto-by-depth', 'uniform', 'none'] as const).map((m) => (
            <label key={m} className="flex items-center gap-1.5 text-sm">
              <input type="radio" checked={config.changefreq === m} onChange={() => update({ changefreq: m })} />
              {m === 'auto-by-depth' ? 'Auto by depth' : m === 'uniform' ? 'Uniform' : 'None'}
            </label>
          ))}
          {config.changefreq === 'uniform' && (
            <select value={config.uniformChangefreq} onChange={(e) => update({ uniformChangefreq: e.target.value as ChangefreqValue })} className="mt-1 w-full px-2 py-1 rounded border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-900">
              {FREQ.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
          {config.changefreq === 'auto-by-depth' && (
            <div className="mt-1 space-y-1">
              {[0, 1, 2, 3].map((d) => (
                <div key={d} className="flex items-center justify-between gap-2 text-xs">
                  <span>Depth {d}{d === 3 ? '+' : ''}</span>
                  <select value={depthFreq(d)} onChange={(e) => setDepthFreq(d, e.target.value as ChangefreqValue)} className="px-1 py-0.5 rounded border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900">
                    {FREQ.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="<priority>">
          {(['auto-calculate', 'uniform', 'none'] as const).map((m) => (
            <label key={m} className="flex items-center gap-1.5 text-sm">
              <input type="radio" checked={config.priority === m} onChange={() => update({ priority: m })} />
              {m === 'auto-calculate' ? 'Auto-calculate' : m === 'uniform' ? 'Uniform' : 'None'}
            </label>
          ))}
          {config.priority === 'uniform' && (
            <input type="number" min={0} max={1} step={0.1} value={config.uniformPriority} onChange={(e) => update({ uniformPriority: Number(e.target.value) })} className="mt-1 w-20 px-2 py-1 rounded border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-900" />
          )}
          {config.priority === 'auto-calculate' && (
            <div className="text-xs text-slate-500 mt-1">1.0 − depth×0.15, +0.1 per 10 inbound, floor 0.1</div>
          )}
        </Section>
      </div>

      <HreflangConfig value={config.hreflang} onChange={(hreflang) => update({ hreflang })} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Section title="Image extension">
          <label className="flex items-center justify-between text-sm">
            Include &lt;image:image&gt;
            <input type="checkbox" checked={config.imageSitemap.enabled} onChange={(e) => update({ imageSitemap: { ...config.imageSitemap, enabled: e.target.checked } })} />
          </label>
        </Section>
        <Section title="Video extension">
          <label className="flex items-center justify-between text-sm">
            Include &lt;video:video&gt;
            <input type="checkbox" checked={config.videoSitemap.enabled} onChange={(e) => update({ videoSitemap: { enabled: e.target.checked } })} />
          </label>
          <div className="text-xs text-slate-400 mt-1">Requires embed URLs (best-effort).</div>
        </Section>
        <Section title="News extension">
          <label className="flex items-center justify-between text-sm">
            Include &lt;news:news&gt;
            <input type="checkbox" checked={config.newsSitemap.enabled} onChange={(e) => update({ newsSitemap: { ...config.newsSitemap, enabled: e.target.checked } })} />
          </label>
          {config.newsSitemap.enabled && (
            <div className="mt-2 space-y-1">
              <input value={config.newsSitemap.publicationName} onChange={(e) => update({ newsSitemap: { ...config.newsSitemap, publicationName: e.target.value } })} placeholder="Publication name" className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs dark:border-slate-600 dark:bg-slate-900" />
              <input defaultValue={config.newsSitemap.urlPatterns.join(', ')} onBlur={(e) => update({ newsSitemap: { ...config.newsSitemap, urlPatterns: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } })} placeholder="/blog/*, /news/*" className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs dark:border-slate-600 dark:bg-slate-900" />
            </div>
          )}
        </Section>
      </div>

      <Section title="Output">
        <div className="flex items-center gap-3 flex-wrap">
          <input value={config.filename} onChange={(e) => update({ filename: e.target.value })} className="px-2 py-1 rounded border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-900" />
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={config.compress} onChange={(e) => update({ compress: e.target.checked })} />
            .xml.gz
          </label>
        </div>
      </Section>

      <div className="flex gap-2">
        <button onClick={doPreview} className="px-4 py-2 rounded-md text-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">👁️ Preview Sitemap</button>
        <button onClick={() => void doExport()} className="px-4 py-2 rounded-md text-sm bg-brand-600 text-white hover:bg-brand-700">💾 Export Sitemap</button>
      </div>

      {preview && <SitemapPreview result={preview} />}
    </div>
  )
}
