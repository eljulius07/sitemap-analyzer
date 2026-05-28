import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { UrlResult } from '@shared/types'
import { computeSummary } from '../utils/summary'
import { healthColorClass } from '../utils/format'

const STATUS_COLORS: Record<string, string> = {
  '2xx': '#10b981',
  '3xx': '#f59e0b',
  '4xx': '#f97316',
  '5xx': '#ef4444',
  Errors: '#a855f7'
}

function Card({
  label,
  value,
  accent
}: {
  label: string
  value: string | number
  accent?: string
}): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <div className={`text-xl font-bold ${accent ?? ''}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

export function SummaryPanel({ results }: { results: UrlResult[] }): JSX.Element {
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="text-sm font-medium mb-2">Status distribution</div>
        <div className="h-44">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                  {chartData.map((d) => (
                    <Cell key={d.name} fill={STATUS_COLORS[d.name]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">No data yet</div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-center mt-1">
          {chartData.map((d) => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[d.name] }} />
              {d.name}: {d.value}
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3 content-start">
        <Card label="Total URLs" value={summary.total.toLocaleString()} />
        <Card label="Avg Health" value={summary.avgHealth} accent={healthColorClass(summary.avgHealth)} />
        <Card label="Avg TTFB" value={`${summary.avgTtfbMs} ms`} />
        <Card label="Critical Issues" value={summary.criticalIssues} accent="text-rose-500" />
        <Card label="Error Pages" value={summary.status4xx + summary.status5xx + summary.errors} accent="text-rose-500" />
        <Card label="Missing Title" value={summary.missingTitle} accent="text-amber-500" />
        <Card label="Missing Meta Desc" value={summary.missingMetaDescription} accent="text-amber-500" />
        <Card label="Missing H1" value={summary.missingH1} accent="text-amber-500" />
        <Card label="Duplicate Titles" value={summary.duplicateTitles} accent="text-amber-500" />
        <Card label="Not Indexable" value={summary.notIndexable} accent="text-rose-500" />
        <Card label="Images Missing Alt" value={summary.imagesMissingAltTotal} accent="text-amber-500" />
        <Card label="Total Issues" value={summary.totalIssues} />
      </div>
    </div>
  )
}
