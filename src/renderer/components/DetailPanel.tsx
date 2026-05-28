import { useState } from 'react'
import type { Category, Issue, UrlResult } from '@shared/types'
import { useStore } from '../stores/analysisStore'
import { useAugmentedResults } from '../hooks/useAnalysis'
import {
  CONTENT_COLUMNS,
  IMAGES_COLUMNS,
  LINKS_COLUMNS,
  PERF_COLUMNS,
  SEO_COLUMNS,
  SOCIAL_COLUMNS,
  TECH_COLUMNS,
  displayValue,
  type Column
} from '../results/columns'
import { copyToClipboard } from '../utils/export'
import { statusColorClass } from '../utils/format'
import { HealthScoreGauge } from './HealthScoreGauge'

type SubTab = 'summary' | Category

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'seo', label: 'SEO' },
  { id: 'performance', label: 'Performance' },
  { id: 'content', label: 'Content' },
  { id: 'technical', label: 'Technical' },
  { id: 'social', label: 'Social' },
  { id: 'images', label: 'Images' },
  { id: 'links', label: 'Links' }
]

const CATEGORY_COLUMNS: Record<Category, Column[]> = {
  seo: SEO_COLUMNS,
  performance: PERF_COLUMNS,
  content: CONTENT_COLUMNS,
  technical: TECH_COLUMNS,
  social: SOCIAL_COLUMNS,
  images: IMAGES_COLUMNS,
  links: LINKS_COLUMNS
}

const RECS: Record<string, string> = {
  title: 'Every page needs a unique, descriptive <title> for search results.',
  titleLength: 'Aim for 30–60 characters so the title is not truncated in SERPs.',
  metaDescription: 'A compelling meta description improves click-through rate.',
  metaDescriptionLength: 'Keep descriptions between 70–160 characters.',
  duplicateTitle: 'Duplicate titles confuse search engines about which page to rank.',
  duplicateDescription: 'Each page should have a distinct meta description.',
  h1: 'Use a single, clear H1 that summarizes the page topic.',
  h1Count: 'Use exactly one H1 per page.',
  isIndexable: 'This page cannot be indexed — check robots directives and canonical.',
  metaRobots: 'A noindex directive prevents this page from appearing in search.',
  canonical: 'Add a self-referencing canonical to consolidate ranking signals.',
  ttfb: 'Reduce server response time (caching, CDN) to improve load speed.',
  renderBlocking: 'Defer or async non-critical JS/CSS to speed first paint.',
  compression: 'Enable gzip/brotli compression to reduce transfer size.',
  https: 'Serve the page over HTTPS for security and ranking.',
  hsts: 'Add a Strict-Transport-Security header on HTTPS pages.',
  ogComplete: 'Complete Open Graph tags improve how links appear when shared.',
  missingAlt: 'Add alt text to images for accessibility and image SEO.',
  jsLinks: 'javascript: links are not crawlable — use real href URLs.',
  wordCount: 'Thin content may rank poorly — add substantive copy.'
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  const pushToast = useStore((s) => s.pushToast)
  const empty = value === '—' || value === ''
  return (
    <div className="flex items-start gap-3 py-1 group">
      <div className="w-44 shrink-0 text-xs text-slate-500 pt-0.5">{label}</div>
      <div className="flex-1 text-sm break-words min-w-0">
        {empty ? <span className="text-slate-400">—</span> : value}
      </div>
      {!empty && (
        <button
          onClick={async () => {
            if (await copyToClipboard(value)) pushToast('success', 'Copied')
          }}
          className="opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-brand-500"
          title="Copy"
        >
          ⧉
        </button>
      )}
    </div>
  )
}

function IssueList({ issues }: { issues: Issue[] }): JSX.Element | null {
  if (issues.length === 0)
    return <div className="text-sm text-emerald-500 py-2">No issues detected ✓</div>
  return (
    <div className="space-y-2 py-1">
      {issues.map((i, idx) => (
        <div
          key={idx}
          className={`p-2.5 rounded-lg text-sm ${
            i.severity === 'critical'
              ? 'bg-rose-50 dark:bg-rose-900/20'
              : i.severity === 'warning'
                ? 'bg-amber-50 dark:bg-amber-900/20'
                : 'bg-slate-50 dark:bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-1.5 font-medium">
            <span>{i.severity === 'critical' ? '🔴' : i.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <span>{i.message}</span>
          </div>
          {RECS[i.field] && <div className="text-xs text-slate-500 mt-1">{RECS[i.field]}</div>}
        </div>
      ))}
    </div>
  )
}

function ArrayBlock({ title, items }: { title: string; items: string[] }): JSX.Element | null {
  if (!items || items.length === 0) return null
  return (
    <details className="mt-2">
      <summary className="text-xs text-slate-500 cursor-pointer">
        {title} ({items.length})
      </summary>
      <ul className="mt-1 space-y-0.5 max-h-48 overflow-auto">
        {items.map((it, i) => (
          <li key={i} className="text-xs break-all text-slate-600 dark:text-slate-300">
            {it}
          </li>
        ))}
      </ul>
    </details>
  )
}

function CategoryView({ result, category }: { result: UrlResult; category: Category }): JSX.Element {
  const cols = CATEGORY_COLUMNS[category]
  const issues = result.issues.filter((i) => i.category === category)
  return (
    <div>
      <IssueList issues={issues} />
      <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-700/50">
        {cols.map((c) => (
          <Row key={c.id} label={c.header} value={displayValue(c.get(result))} />
        ))}
      </div>
      {category === 'performance' && result.performance && (
        <>
          <ArrayBlock title="JS File URLs" items={result.performance.jsFileUrls} />
          <ArrayBlock title="CSS File URLs" items={result.performance.cssFileUrls} />
          <ArrayBlock title="Render-Blocking JS" items={result.performance.renderBlockingJs} />
          <ArrayBlock title="Render-Blocking CSS" items={result.performance.renderBlockingCss} />
        </>
      )}
      {category === 'social' && result.social && (
        <ArrayBlock title="Raw JSON-LD" items={result.social.rawJsonLd} />
      )}
      {category === 'images' && result.images && (
        <ArrayBlock title="Image URLs" items={result.images.imageUrls} />
      )}
      {category === 'content' && result.content && (
        <ArrayBlock title="iframe Domains" items={result.content.iframeDomains} />
      )}
      {category === 'links' && result.links && (
        <ArrayBlock title="External Domains" items={result.links.externalDomains} />
      )}
    </div>
  )
}

function SummaryView({ result }: { result: UrlResult }): JSX.Element {
  const scoreEntries = Object.entries(result.scores) as [Category, number][]
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {scoreEntries.map(([cat, score]) => (
          <div key={cat} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-center">
            <div className="text-lg font-bold">{score}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400 capitalize">{cat}</div>
          </div>
        ))}
      </div>
      <h4 className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
        All Issues ({result.issues.length})
      </h4>
      <IssueList issues={result.issues} />
    </div>
  )
}

export function DetailPanel(): JSX.Element | null {
  const id = useStore((s) => s.selectedUrlId)
  const selectUrl = useStore((s) => s.selectUrl)
  const augmented = useAugmentedResults()
  const [subTab, setSubTab] = useState<SubTab>('summary')

  const result = augmented.find((r) => r.id === id)
  if (id === null || !result) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={() => selectUrl(null)} />
      <div className="fixed right-0 top-0 bottom-0 w-[40%] min-w-[440px] max-w-[680px] bg-white dark:bg-slate-900 shadow-2xl z-40 flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <HealthScoreGauge score={result.healthScore} size={84} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-bold ${statusColorClass(result.http.statusCode)}`}>
                {result.http.statusCode ?? 'ERROR'}
              </span>
              <span className="text-xs text-slate-500">{result.http.statusText}</span>
            </div>
            <a href={result.url} className="text-sm text-brand-500 hover:underline break-all" title={result.url}>
              {result.url}
            </a>
          </div>
          <button
            onClick={() => selectUrl(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-lg leading-none self-start"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-1 px-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
          {SUB_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-2.5 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px ${
                subTab === t.id
                  ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {subTab === 'summary' ? (
            <SummaryView result={result} />
          ) : (
            <CategoryView result={result} category={subTab} />
          )}
        </div>
      </div>
    </>
  )
}
