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

  const totalWidth = columns.reduce((sum, c) => sum + c.size, 0)

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

  return (
    <div ref={parentRef} className="h-full overflow-auto border-t border-slate-200 dark:border-slate-700">
      <table className="text-sm border-collapse" style={{ minWidth: totalWidth }}>
        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900">
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                style={{ width: col.size, minWidth: col.size }}
                onClick={() => onSort(col.id)}
                className={`px-2 py-2 font-medium text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none whitespace-nowrap ${
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                }`}
              >
                {col.header}
                {sortCol === col.id ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
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
                {columns.map((col) => (
                  <td
                    key={col.id}
                    style={{ width: col.size, minWidth: col.size, maxWidth: col.size }}
                    className={`px-2 py-1.5 whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    <Cell column={col} row={row} />
                  </td>
                ))}
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
