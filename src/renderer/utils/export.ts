import ExcelJS from 'exceljs'
import type { Category, UrlResult } from '@shared/types'
import {
  ALL_COLUMNS,
  csvValue,
  displayValue,
  SHEET_COLUMNS,
  SITE_STRUCTURE_COLUMNS,
  TAB_COLUMNS,
  type CellValue,
  type Column
} from '../results/columns'
import type { TabId } from '../stores/analysisStore'
import { computeSummary, type Summary } from './summary'

type SaveResult = { saved: boolean; path?: string; error?: string }

function timestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function buildCsv(results: UrlResult[], columns: Column[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(',')
  const rows = results.map((r) =>
    columns.map((c) => escapeCsvCell(csvValue(c.get(r)))).join(',')
  )
  // UTF-8 BOM for Excel compatibility.
  return '﻿' + [header, ...rows].join('\r\n')
}

export async function exportCsv(
  results: UrlResult[],
  mode: 'all' | 'current-tab',
  activeTab: TabId
): Promise<SaveResult> {
  const columns = mode === 'all' ? ALL_COLUMNS : TAB_COLUMNS[activeTab]
  const csv = buildCsv(results, columns)
  const suffix = mode === 'all' ? 'all' : activeTab
  return window.api.saveExport(`sitemap-report-${suffix}-${timestamp()}.csv`, csv)
}

// ---- XLSX ----
function xlsxCell(v: CellValue): string | number {
  if (v === null) return ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) return v.join(' | ')
  return v
}

const FILL_RED = 'FFFCE4E4'
const FILL_YELLOW = 'FFFEF9C3'
const FILL_GREEN = 'FFDCFCE7'
const FILL_HEADER = 'FF1E293B'

function styleSheet(ws: ExcelJS.Worksheet, columns: Column[], results: UrlResult[]): void {
  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.id,
    width: Math.max(10, Math.min(60, Math.round(c.size / 7)))
  }))

  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_HEADER } }
  headerRow.alignment = { vertical: 'middle' }

  for (const r of results) {
    const row = ws.addRow(Object.fromEntries(columns.map((c) => [c.id, xlsxCell(c.get(r))])))
    columns.forEach((c, idx) => {
      const cell = row.getCell(idx + 1)
      const level = c.flag?.(r) ?? null
      const value = c.get(r)
      let fill: string | null = null
      if (level === 'critical') fill = FILL_RED
      else if (level === 'warning') fill = FILL_YELLOW
      else if (typeof value === 'boolean' && value && c.flag) fill = FILL_GREEN
      if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    })
  }

  ws.views = [{ state: 'frozen', ySplit: 1 }]
  if (columns.length > 0 && results.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  }
}

export async function buildWorkbook(
  results: UrlResult[],
  source: string
): Promise<ExcelJS.Workbook> {
  const summary = computeSummary(results)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Sitemap Analyzer'
  wb.created = new Date()

  // Summary sheet first.
  const sum = wb.addWorksheet('Summary')
  sum.columns = [
    { header: 'Metric', key: 'metric', width: 28 },
    { header: 'Value', key: 'value', width: 40 }
  ]
  sum.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sum.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_HEADER } }
  const rows: [string, string | number][] = [
    ['Total URLs', summary.total],
    ['Crawl date', new Date().toLocaleString()],
    ['Sitemap source', source],
    ['Average health score', summary.avgHealth],
    ['Average TTFB (ms)', summary.avgTtfbMs],
    ['2xx', summary.status2xx],
    ['3xx', summary.status3xx],
    ['4xx', summary.status4xx],
    ['5xx', summary.status5xx],
    ['Errors', summary.errors],
    ['Total issues', summary.totalIssues],
    ['Critical issues', summary.criticalIssues]
  ]
  rows.forEach((r) => sum.addRow({ metric: r[0], value: r[1] }))

  sum.addRow({})
  const catHeader = sum.addRow({ metric: 'Category', value: 'Critical / Warning' })
  catHeader.font = { bold: true }
  ;(Object.keys(summary.byCategory) as Category[]).forEach((cat) => {
    const c = summary.byCategory[cat]
    sum.addRow({ metric: cat, value: `${c.critical} / ${c.warning}` })
  })

  sum.addRow({})
  const worstHeader = sum.addRow({ metric: 'Top 10 worst URLs', value: 'Health' })
  worstHeader.font = { bold: true }
  summary.worst.forEach((r) => sum.addRow({ metric: r.url, value: r.healthScore }))

  // One sheet per category.
  for (const { name, columns } of SHEET_COLUMNS) {
    const ws = wb.addWorksheet(name)
    styleSheet(ws, columns, results)
  }

  // Spider "Site Structure" sheet (depth-sorted), only when spider data present.
  if (results.some((r) => r.spider)) {
    const sorted = [...results].sort((a, b) => {
      const da = a.spider?.depth ?? 0
      const db = b.spider?.depth ?? 0
      return da !== db ? da - db : a.url.localeCompare(b.url)
    })
    const ws = wb.addWorksheet('Site Structure')
    styleSheet(ws, SITE_STRUCTURE_COLUMNS, sorted)
  }

  return wb
}

export async function exportXlsx(results: UrlResult[], source: string): Promise<SaveResult> {
  const wb = await buildWorkbook(results, source)
  const buffer = await wb.xlsx.writeBuffer()
  const data = new Uint8Array(buffer)
  return window.api.saveExportBinary(`sitemap-report-${timestamp()}.xlsx`, data)
}

// ---- HTML report ----
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function healthBuckets(results: UrlResult[]): number[] {
  const b = [0, 0, 0, 0, 0] // 0-29,30-49,50-69,70-89,90-100
  for (const r of results) {
    const s = r.healthScore
    if (s >= 90) b[4]++
    else if (s >= 70) b[3]++
    else if (s >= 50) b[2]++
    else if (s >= 30) b[1]++
    else b[0]++
  }
  return b
}

function distributionSvg(results: UrlResult[]): string {
  const buckets = healthBuckets(results)
  const labels = ['0–29', '30–49', '50–69', '70–89', '90–100']
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981']
  const max = Math.max(1, ...buckets)
  const bw = 90
  const gap = 24
  const h = 160
  const bars = buckets
    .map((v, i) => {
      const bh = Math.round((v / max) * 120)
      const x = i * (bw + gap) + 10
      const y = h - bh - 20
      return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${colors[i]}"/>
        <text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="13" fill="currentColor">${v}</text>
        <text x="${x + bw / 2}" y="${h - 4}" text-anchor="middle" font-size="11" fill="currentColor">${labels[i]}</text>`
    })
    .join('')
  const width = buckets.length * (bw + gap) + 10
  return `<svg viewBox="0 0 ${width} ${h}" width="100%" style="max-width:${width}px">${bars}</svg>`
}

function keyFindings(summary: Summary): string[] {
  const f: string[] = []
  if (summary.missingMetaDescription) f.push(`${summary.missingMetaDescription} pages missing meta description`)
  if (summary.missingTitle) f.push(`${summary.missingTitle} pages missing a title`)
  if (summary.missingH1) f.push(`${summary.missingH1} pages missing an H1`)
  if (summary.duplicateTitles) f.push(`${summary.duplicateTitles} pages with duplicate titles`)
  if (summary.notIndexable) f.push(`${summary.notIndexable} pages not indexable`)
  if (summary.imagesMissingAltTotal) f.push(`${summary.imagesMissingAltTotal} images missing alt text`)
  if (summary.status4xx + summary.status5xx + summary.errors)
    f.push(`${summary.status4xx + summary.status5xx + summary.errors} pages with errors`)
  return f
}

function urlSection(r: UrlResult): string {
  const groups: { name: string; cols: Column[] }[] = SHEET_COLUMNS.filter(
    (g) => g.name !== 'Overview'
  ).map((g) => ({ name: g.name, cols: g.columns.filter((c) => c.kind === undefined) }))

  const issuesHtml = r.issues.length
    ? `<div class="issues">${r.issues
        .map(
          (i) =>
            `<span class="badge ${i.severity}">${i.severity === 'critical' ? '🔴' : i.severity === 'warning' ? '⚠️' : 'ℹ️'} ${esc(i.message)}</span>`
        )
        .join('')}</div>`
    : '<div class="ok">No issues detected ✅</div>'

  const cats = groups
    .map(
      (g) =>
        `<div class="cat"><h4>${esc(g.name)}</h4><dl>${g.cols
          .map((c) => `<dt>${esc(c.header)}</dt><dd>${esc(displayValue(c.get(r)))}</dd>`)
          .join('')}</dl></div>`
    )
    .join('')

  return `<details>
    <summary><span class="score s${Math.floor(r.healthScore / 20)}">${r.healthScore}</span>
      <span class="status">${r.http.statusCode ?? 'ERR'}</span>
      <span class="u">${esc(r.url)}</span></summary>
    <div class="body">${issuesHtml}${cats}</div>
  </details>`
}

function spiderSection(results: UrlResult[]): string {
  if (!results.some((r) => r.spider)) return ''
  const sorted = [...results].sort((a, b) => (a.spider?.depth ?? 0) - (b.spider?.depth ?? 0))
  const rows = sorted
    .slice(0, 1000)
    .map((r) => {
      const s = r.spider!
      const indent = '&nbsp;'.repeat(s.depth * 4)
      const badge = `<span class="score s${Math.floor(r.healthScore / 20)}">${r.healthScore}</span>`
      return `<div>${indent}${badge} <span class="status">${r.http.statusCode ?? 'ERR'}</span> <span class="u">${esc(r.url)}</span> <span class="note">in:${s.inboundInternal} out:${s.outboundInternal}</span></div>`
    })
    .join('')
  const orphans = results.filter((r) => r.spider?.isOrphan)
  const deadEnds = results.filter((r) => r.spider?.isDeadEnd)
  const list = (arr: UrlResult[]): string =>
    arr.slice(0, 100).map((r) => `<li>${esc(r.url)}</li>`).join('') || '<li>None</li>'
  return `<div class="panel">
    <h3>Site Structure</h3>
    <div style="font-size:12px;line-height:1.7">${rows}</div>
    <details style="margin-top:12px"><summary>Orphan pages (${orphans.length})</summary><ul>${list(orphans)}</ul></details>
    <details><summary>Dead ends (${deadEnds.length})</summary><ul>${list(deadEnds)}</ul></details>
  </div>`
}

export function generateHtmlReport(
  results: UrlResult[],
  source: string
): string {
  const summary = computeSummary(results)
  const findings = keyFindings(summary)
    .map((f) => `<li>${esc(f)}</li>`)
    .join('')
  const catRows = (Object.keys(summary.byCategory) as Category[])
    .map(
      (c) =>
        `<tr><td>${c}</td><td>${summary.byCategory[c].critical}</td><td>${summary.byCategory[c].warning}</td></tr>`
    )
    .join('')
  // Bound report size for very large crawls.
  const LIMIT = 1000
  const shown = results.slice(0, LIMIT)
  const truncated =
    results.length > LIMIT
      ? `<p class="note">Showing first ${LIMIT} of ${results.length} URLs.</p>`
      : ''

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Sitemap Analyzer Report</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; background: #f8fafc; color: #0f172a; }
  h1 { margin-bottom: 2px; } .sub { color: #64748b; font-size: 13px; margin-bottom: 20px; }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; min-width: 120px; }
  .card .v { font-size: 22px; font-weight: 700; } .card .l { font-size: 12px; color: #64748b; }
  .panel { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 16px 0; }
  table { border-collapse: collapse; } th, td { border: 1px solid #e2e8f0; padding: 4px 10px; text-align: left; font-size: 13px; }
  details { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; margin: 6px 0; }
  summary { cursor: pointer; padding: 8px 12px; display: flex; align-items: center; gap: 10px; }
  .score { font-weight: 700; padding: 2px 8px; border-radius: 6px; color: #fff; }
  .score.s0,.score.s1 { background: #ef4444; } .score.s2 { background: #f59e0b; } .score.s3 { background: #84cc16; } .score.s4 { background: #10b981; }
  .status { color: #64748b; font-variant-numeric: tabular-nums; } .u { font-size: 13px; word-break: break-all; }
  .body { padding: 10px 14px; border-top: 1px solid #e2e8f0; }
  .issues { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .badge { font-size: 12px; padding: 2px 8px; border-radius: 12px; background: #f1f5f9; }
  .badge.critical { background: #fee2e2; } .badge.warning { background: #fef9c3; }
  .ok { color: #16a34a; margin-bottom: 10px; }
  .cat { margin: 8px 0; } .cat h4 { margin: 6px 0; font-size: 13px; color: #334155; }
  dl { display: grid; grid-template-columns: 180px 1fr; gap: 2px 12px; margin: 0; font-size: 12px; }
  dt { color: #64748b; } dd { margin: 0; word-break: break-word; }
  .note { color: #64748b; font-size: 13px; }
  @media (prefers-color-scheme: dark) {
    body { background: #0f172a; color: #e2e8f0; }
    .card, .panel, details { background: #1e293b; border-color: #334155; }
    th, td { border-color: #334155; } .badge { background: #334155; }
    .badge.critical { background: #7f1d1d; } .badge.warning { background: #78350f; }
    .body { border-color: #334155; }
  }
  @media print { details { break-inside: avoid; } summary { list-style: none; } body { margin: 0; } }
</style></head>
<body>
  <h1>Sitemap Analyzer Report</h1>
  <div class="sub">Generated ${esc(new Date().toLocaleString())} · Source: ${esc(source || 'n/a')} · ${summary.total} URLs</div>

  <div class="cards">
    <div class="card"><div class="v">${summary.total}</div><div class="l">Total URLs</div></div>
    <div class="card"><div class="v">${summary.avgHealth}</div><div class="l">Avg Health</div></div>
    <div class="card"><div class="v">${summary.avgTtfbMs}ms</div><div class="l">Avg TTFB</div></div>
    <div class="card"><div class="v">${summary.criticalIssues}</div><div class="l">Critical Issues</div></div>
    <div class="card"><div class="v">${summary.status4xx + summary.status5xx + summary.errors}</div><div class="l">Error Pages</div></div>
  </div>

  <div class="panel">
    <h3>Health Score Distribution</h3>
    <div style="color:#334155">${distributionSvg(results)}</div>
  </div>

  <div class="panel">
    <h3>Issue Breakdown by Category</h3>
    <table><tr><th>Category</th><th>Critical</th><th>Warning</th></tr>${catRows}</table>
  </div>

  <div class="panel">
    <h3>Key Findings</h3>
    <ul>${findings || '<li>No major issues found 🎉</li>'}</ul>
  </div>

  ${spiderSection(results)}

  <h3>Per-URL Detail</h3>
  ${truncated}
  ${shown.map(urlSection).join('')}
</body></html>`
}

export async function exportHtml(results: UrlResult[], source: string): Promise<SaveResult> {
  const html = generateHtmlReport(results, source)
  return window.api.saveExport(`sitemap-report-${timestamp()}.html`, html)
}

export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}
