import { useState, type DragEvent } from 'react'
import { useStore } from '../stores/analysisStore'

export function SitemapInput(): JSX.Element {
  const [url, setUrl] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const parsing = useStore((s) => s.parsing)
  const urls = useStore((s) => s.urls)
  const sitemapCount = useStore((s) => s.sitemapCount)
  const parseError = useStore((s) => s.parseError)
  const pickFile = useStore((s) => s.pickFile)
  const parseFile = useStore((s) => s.parseFile)
  const parseUrl = useStore((s) => s.parseUrl)
  const clearSitemap = useStore((s) => s.clearSitemap)
  const startAnalysis = useStore((s) => s.startAnalysis)

  const onDrop = (e: DragEvent): void => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    // Electron exposes the absolute path on dropped File objects.
    const path = (file as unknown as { path?: string })?.path
    if (path) void parseFile(path)
  }

  const handleUrl = (): void => {
    const trimmed = url.trim()
    if (trimmed) void parseUrl(trimmed)
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-slate-500">
            Load a sitemap.xml to crawl every URL and run a full SEO audit.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => void pickFile()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
            dragOver
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
              : 'border-slate-300 hover:border-brand-400 dark:border-slate-700'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-12 h-12 mx-auto text-brand-500 mb-3"
            fill="none"
            stroke="currentColor"
          >
            <path d="M12 16V4m0 0L8 8m4-4 4 4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <div className="font-medium">Drop your sitemap here, or click to browse</div>
          <div className="text-sm text-slate-500 mt-1">Supports .xml and .xml.gz files</div>
        </div>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          <span className="text-xs uppercase tracking-wide text-slate-400">or</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        </div>

        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUrl()}
            placeholder="https://example.com/sitemap.xml"
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800"
          />
          <button
            onClick={handleUrl}
            disabled={parsing || !url.trim()}
            className="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            Fetch
          </button>
        </div>

        {parsing && (
          <div className="mt-6 text-center text-sm text-slate-500">
            <div className="inline-block w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-2 align-middle" />
            Parsing sitemap…
          </div>
        )}

        {parseError && (
          <div className="mt-6 px-4 py-3 rounded-lg bg-rose-50 text-rose-700 text-sm dark:bg-rose-900/30 dark:text-rose-300">
            {parseError}
          </div>
        )}

        {!parsing && urls.length > 0 && (
          <div className="mt-6 p-5 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{urls.length.toLocaleString()}</div>
                <div className="text-sm text-slate-500">
                  URLs found across {sitemapCount} sitemap{sitemapCount === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={clearSitemap}
                  className="px-4 py-2 rounded-lg text-sm border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
                >
                  Clear
                </button>
                <button
                  onClick={() => void startAnalysis()}
                  className="px-5 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
                >
                  Analyze {urls.length.toLocaleString()} URLs
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
