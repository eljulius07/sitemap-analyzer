import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { UrlResult } from '@shared/types'
import { useStore } from '../stores/analysisStore'
import {
  displayValue,
  sortValue,
  type CellValue,
  type Column,
  type FlagLevel
} from '../results/columns'
import { healthColorClass, statusColorClass } from '../utils/format'

const WIDTHS_KEY = 'sitemap-analyzer:column-widths'
const MIN_COL_WIDTH = 50

const flagClass: Record<NonNullable<FlagLevel>, string> = {
  critical: 'text-rose-500 font-semibold',
  warning: 'text-amber-500 font-medium'
}

const rowBg: Record<UrlResult['rowStatus'], string> = {
  ok: 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
  warning:
    'bg-amber-50/50 hover:bg-amber-100/60 dark:bg-amber-900/10 dark:hover:bg-amber-900/20',
  error: 'bg-rose-50/60 hover:bg-rose-100/70 dark:bg-rose-900/15 dark:hover:bg-rose-900/25'
}

function loadWidths(): Record<string, number> {
  try {
    const raw = localStorage.getItem(WIDTHS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function Cell({ column, row }: { column: Column; row: UrlResult }): JSX.Element {
  const value: CellValue = column.get(row)

  if (column.kind === 'status') {
    return (
      <span className={`font-semibold ${statusColorClass(row.http.statusCode)}`}>
        {row.http.statusCode ?? 'ERR'}
      </span>
    )
  }
  if (column.kind === 'health') {
    return <span className={`font-bold ${healthColorClass(row.healthScore)}`}>{row.healthScore}</span>
  }
  if (column.kind === 'url') {
    const text = String(value).replace(/^https?:\/\//, '')
    return (
      <span className="block truncate" title={String(value)}>
        {text}
      </span>
    )
  }

  const level = column.flag?.(row) ?? null
  const cls = level ? flagClass[level] : ''
  const display = displayValue(value)
  if (typeof value === 'boolean') {
    return <span className={cls || (value ? 'text-emerald-500' : 'text-slate-400')}>{value ? '✓' : '✗'}</span>
  }
  return (
    <span className={`block truncate ${cls}`} title={display}>
      {display}
    </span>
  )
}

export function ResultsTable({
  columns,
  data
}: {
  columns: Column[]
  data: UrlResult[]
}): JSX.Element {
  const selectUrl = useStore((s) => s.selectUrl)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [widths, setWidths] = useState<Record<string, number>>(loadWidths)

  const widthOf = (col: Column): number => widths[col.id] ?? col.size

  const sorted = useMemo(() => {
    if (!sortCol) return data
    const col = columns.find((c) => c.id === sortCol)
    if (!col) return data
    const dir = sortDir === 'asc' ? 1 : -1
    return [...data].sort((a, b) => {
      const av = sortValue(col.get(a))
      const bv = sortValue(col.get(b))
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [data, columns, sortCol, sortDir])

  const totalWidth = columns.reduce((sum, c) => sum + widthOf(c), 0)

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 14
  })
  const virtualRows = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0

  const onSort = (id: string): void => {
    if (sortCol === id) {
      if (sortDir === 'asc') setSortDir('desc')
      else {
        setSortCol(null)
        setSortDir('asc')
      }
    } else {
      setSortCol(id)
      setSortDir('asc')
    }
  }

  /** Begin dragging the right edge of a column header to resize it. */
  const startResize = (col: Column, event: React.MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = widthOf(col)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (e: MouseEvent): void => {
      const next = Math.max(MIN_COL_WIDTH, Math.round(startWidth + (e.clientX - startX)))
      setWidths((w) => ({ ...w, [col.id]: next }))
    }
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      // Persist using the freshest state.
      setWidths((w) => {
        try {
          localStorage.setItem(WIDTHS_KEY, JSON.stringify(w))
        } catch {
          /* ignore quota errors */
        }
        return w
      })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const resetWidth = (col: Column): void => {
    setWidths((w) => {
      const next = { ...w }
      delete next[col.id]
      try {
        localStorage.setItem(WIDTHS_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto border-t border-slate-200 dark:border-slate-700">
      <table className="text-sm border-collapse" style={{ minWidth: totalWidth }}>
        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900">
          <tr>
            {columns.map((col) => {
              const w = widthOf(col)
              return (
                <th
                  key={col.id}
                  style={{ width: w, minWidth: w, maxWidth: w, position: 'relative' }}
                  onClick={() => onSort(col.id)}
                  className={`px-2 py-2 font-medium text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {col.header}
                  {sortCol === col.id ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  <span
                    role="separator"
                    aria-label={`Resize ${col.header} column`}
                    title="Drag to resize · double-click to reset"
                    onMouseDown={(e) => startResize(col, e)}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      resetWidth(col)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-brand-500/50 active:bg-brand-500"
                  />
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: paddingTop }} colSpan={columns.length} />
            </tr>
          )}
          {virtualRows.map((vr) => {
            const row = sorted[vr.index]
            return (
              <tr
                key={row.id}
                onClick={() => selectUrl(row.id)}
                className={`cursor-pointer border-b border-slate-100 dark:border-slate-700/50 ${rowBg[row.rowStatus]}`}
              >
                {columns.map((col) => {
                  const w = widthOf(col)
                  return (
                    <td
                      key={col.id}
                      style={{ width: w, minWidth: w, maxWidth: w }}
                      className={`px-2 py-1.5 whitespace-nowrap ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      <Cell column={col} row={row} />
                    </td>
                  )
                })}
              </tr>
            )
          })}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: paddingBottom }} colSpan={columns.length} />
            </tr>
          )}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                No URLs match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
