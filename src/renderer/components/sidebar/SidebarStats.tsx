import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { UrlResult } from '@shared/types'
import type { TabId } from '../../stores/analysisStore'
import { computeSummary } from '../../utils/summary'

const STATUS_COLORS: Record<string, string> = {
  '2xx': '#10b981',
  '3xx': '#f59e0b',
  '4xx': '#f97316',
  '5xx': '#ef4444',
  Errors: '#a855f7'
}

function Row({ label, value, accent }: { label: string; value: string | number; accent?: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold tabular-nums ${accent ?? ''}`}>{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1.5">{title}</div>
      <div className="rounded-md border border-slate-200 dark:border-slate-700 p-2 divide-y divide-slate-100 dark:divide-slate-700/50">
        {children}
      </div>
    </div>
  )
}

function StatusDonut({ data }: { data: { name: string; value: number }[] }): JSX.Element {
  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={32} outerRadius={56} paddingAngle={2}>
            {data.map((d) => (
              <Cell key={d.name} fill={STATUS_COLORS[d.name]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SidebarStats({ results, tab }: { results: UrlResult[]; tab: TabId }): JSX.Element {
  const summary = useMemo(() => computeSummary(results), [results])

  const chartData = useMemo(
    () =>
      [
        { name: '2xx', value: summary.status2xx },
        { name: '3xx', value: summary.status3xx },
        { name: '4xx', value: summary.status4xx },
        { name: '5xx', value: summary.status5xx },
        { name: 'Errors', value: summary.errors }
      ].filter((d) => d.value > 0),
    [summary]
  )

  const ttfb = (n: number): string => (n > 0 ? `${n}ms` : '—')

  if (tab === 'overview') {
    return (
      <div>
        <Section title="Resumen general">
          <Row label="Total URLs" value={summary.total.toLocaleString()} />
          <Row label="Avg health" value={summary.avgHealth} />
          <Row label="Avg TTFB" value={ttfb(summary.avgTtfbMs)} />
          <Row label="Critical issues" value={summary.criticalIssues} accent="text-rose-500" />
          <Row label="Error pages" value={summary.status4xx + summary.status5xx + summary.errors} accent="text-rose-500" />
          <Row label="Total issues" value={summary.totalIssues} />
        </Section>
        <Section title="Códigos de respuesta">
          <Row label="2xx (OK)" value={summary.status2xx} accent="text-emerald-500" />
          <Row label="3xx (redirect)" value={summary.status3xx} accent="text-amber-500" />
          <Row label="4xx (client)" value={summary.status4xx} accent="text-orange-500" />
          <Row label="5xx (server)" value={summary.status5xx} accent="text-rose-500" />
          <Row label="Errors / no response" value={summary.errors} accent="text-fuchsia-500" />
        </Section>
        {chartData.length > 0 && (
          <Section title="Distribución">
            <StatusDonut data={chartData} />
          </Section>
        )}
      </div>
    )
  }

  if (tab === 'seo') {
    const totalSeoScore = results.reduce((s, r) => s + r.scores.seo, 0)
    const avgSeo = results.length ? Math.round(totalSeoScore / results.length) : 0
    return (
      <div>
        <Section title="SEO summary">
          <Row label="Avg SEO score" value={avgSeo} />
          <Row label="Missing title" value={summary.missingTitle} accent="text-amber-500" />
          <Row label="Missing meta desc" value={summary.missingMetaDescription} accent="text-amber-500" />
          <Row label="Missing H1" value={summary.missingH1} accent="text-amber-500" />
          <Row label="Duplicate titles" value={summary.duplicateTitles} accent="text-rose-500" />
          <Row label="Duplicate descs" value={summary.duplicateDescriptions} accent="text-rose-500" />
          <Row label="Not indexable" value={summary.notIndexable} accent="text-rose-500" />
        </Section>
      </div>
    )
  }

  if (tab === 'performance') {
    const avgTtfb = summary.avgTtfbMs
    const slow = results.filter((r) => (r.performance?.ttfbMs ?? 0) > 2000).length
    const heavy = results.filter((r) => (r.performance?.totalPageWeightKb ?? 0) > 3000).length
    const notCompressed = results.filter((r) => r.performance && !r.performance.htmlCompressed).length
    const renderBlocking = results.reduce((s, r) => s + (r.performance?.renderBlockingCount ?? 0), 0)
    return (
      <Section title="Performance">
        <Row label="Avg TTFB" value={ttfb(avgTtfb)} />
        <Row label="Slow pages (>2s)" value={slow} accent={slow ? 'text-rose-500' : ''} />
        <Row label="Heavy pages (>3MB)" value={heavy} accent={heavy ? 'text-amber-500' : ''} />
        <Row label="Not compressed" value={notCompressed} accent={notCompressed ? 'text-amber-500' : ''} />
        <Row label="Render-blocking total" value={renderBlocking} />
      </Section>
    )
  }

  if (tab === 'content') {
    const thin = results.filter((r) => (r.content?.wordCount ?? 0) < 300 && r.content).length
    const lowRatio = results.filter((r) => (r.content?.textHtmlRatio ?? 100) < 10).length
    const avgWords = results.length
      ? Math.round(results.reduce((s, r) => s + (r.content?.wordCount ?? 0), 0) / results.length)
      : 0
    return (
      <Section title="Content">
        <Row label="Avg word count" value={avgWords.toLocaleString()} />
        <Row label="Thin content (<300)" value={thin} accent={thin ? 'text-amber-500' : ''} />
        <Row label="Low text/HTML ratio" value={lowRatio} accent={lowRatio ? 'text-amber-500' : ''} />
      </Section>
    )
  }

  if (tab === 'technical') {
    const notHttps = results.filter((r) => r.technical && !r.technical.https).length
    const noViewport = results.filter((r) => r.technical && !r.technical.hasViewport).length
    const noDoctype = results.filter((r) => r.technical && !r.technical.hasDoctype).length
    const noFavicon = results.filter((r) => r.technical && !r.technical.hasFavicon).length
    const noHsts = results.filter((r) => r.technical && r.technical.https && !r.technical.strictTransportSecurity).length
    return (
      <Section title="Technical">
        <Row label="Not HTTPS" value={notHttps} accent={notHttps ? 'text-rose-500' : ''} />
        <Row label="Missing viewport" value={noViewport} accent={noViewport ? 'text-amber-500' : ''} />
        <Row label="Missing doctype" value={noDoctype} accent={noDoctype ? 'text-amber-500' : ''} />
        <Row label="Missing favicon" value={noFavicon} accent={noFavicon ? 'text-amber-500' : ''} />
        <Row label="Missing HSTS (on https)" value={noHsts} accent={noHsts ? 'text-amber-500' : ''} />
      </Section>
    )
  }

  if (tab === 'social') {
    const ogIncomplete = results.filter((r) => r.social && !r.social.ogComplete).length
    const noSchema = results.filter((r) => r.social && !r.social.hasStructuredData).length
    const invalidJsonLd = results.filter((r) => r.social && r.social.schemaCount > 0 && !r.social.jsonLdValid).length
    return (
      <Section title="Social & Schema">
        <Row label="OG incomplete" value={ogIncomplete} accent={ogIncomplete ? 'text-amber-500' : ''} />
        <Row label="No structured data" value={noSchema} accent={noSchema ? 'text-amber-500' : ''} />
        <Row label="Invalid JSON-LD" value={invalidJsonLd} accent={invalidJsonLd ? 'text-rose-500' : ''} />
      </Section>
    )
  }

  if (tab === 'images') {
    const totalImgs = results.reduce((s, r) => s + (r.images?.totalImages ?? 0), 0)
    const missingAlt = results.reduce((s, r) => s + (r.images?.missingAlt ?? 0), 0)
    const missingDims = results.reduce((s, r) => s + (r.images?.missingDimensions ?? 0), 0)
    const nextGen = results.reduce((s, r) => s + (r.images?.nextGenFormats ?? 0), 0)
    const legacy = results.reduce((s, r) => s + (r.images?.legacyFormats ?? 0), 0)
    return (
      <Section title="Images">
        <Row label="Total images" value={totalImgs.toLocaleString()} />
        <Row label="Missing alt" value={missingAlt} accent={missingAlt ? 'text-rose-500' : ''} />
        <Row label="Missing dimensions" value={missingDims} accent={missingDims ? 'text-amber-500' : ''} />
        <Row label="Next-gen formats" value={nextGen} />
        <Row label="Legacy formats" value={legacy} />
      </Section>
    )
  }

  if (tab === 'links') {
    const totalLinks = results.reduce((s, r) => s + (r.links?.totalLinks ?? 0), 0)
    const internal = results.reduce((s, r) => s + (r.links?.internalLinks ?? 0), 0)
    const external = results.reduce((s, r) => s + (r.links?.externalLinks ?? 0), 0)
    const jsLinks = results.reduce((s, r) => s + (r.links?.javascriptLinks ?? 0), 0)
    return (
      <Section title="Links">
        <Row label="Total links" value={totalLinks.toLocaleString()} />
        <Row label="Internal" value={internal.toLocaleString()} />
        <Row label="External" value={external.toLocaleString()} />
        <Row label="javascript: links" value={jsLinks} accent={jsLinks ? 'text-rose-500' : ''} />
      </Section>
    )
  }

  return <div className="text-xs text-slate-400">No stats for this view.</div>
}
