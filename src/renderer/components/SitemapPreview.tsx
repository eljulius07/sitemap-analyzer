import type { SitemapResult } from '../utils/sitemap-generator'

function byteLen(s: string): number {
  return new Blob([s]).size
}

export function SitemapPreview({ result }: { result: SitemapResult }): JSX.Element {
  const main = result.files[0]
  const totalBytes = result.files.reduce((s, f) => s + byteLen(f.content), 0)
  const dupCheck = (() => {
    const locs = (main?.content.match(/<loc>(.*?)<\/loc>/g) ?? []).map((l) => l)
    return new Set(locs).size === locs.length
  })()
  const wellFormed = !main || main.content.trimStart().startsWith('<?xml') || main.name.endsWith('.txt')

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 bg-slate-100 dark:bg-slate-900 text-xs">
        <span><span className="text-slate-400">URLs:</span> <b>{result.urlCount.toLocaleString()}</b></span>
        <span><span className="text-slate-400">Files:</span> <b>{result.files.length}</b></span>
        <span><span className="text-slate-400">Size:</span> <b>{(totalBytes / 1024).toFixed(1)} KB</b></span>
        <span className={wellFormed ? 'text-emerald-500' : 'text-rose-500'}>{wellFormed ? '✓ well-formed' : '✗ malformed'}</span>
        <span className={dupCheck ? 'text-emerald-500' : 'text-rose-500'}>{dupCheck ? '✓ no duplicate URLs' : '✗ duplicates found'}</span>
        {result.isIndex && <span className="text-brand-500">sitemap index ({result.files.length - 1} parts)</span>}
      </div>
      {result.warnings.length > 0 && (
        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-300">
          {result.warnings.map((w, i) => (
            <div key={i}>⚠️ {w}</div>
          ))}
        </div>
      )}
      <pre className="p-3 text-xs overflow-auto max-h-[40vh] bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 whitespace-pre">
        {main ? main.content.slice(0, 20000) : '(empty)'}
        {main && main.content.length > 20000 ? '\n… (truncated preview)' : ''}
      </pre>
    </div>
  )
}
