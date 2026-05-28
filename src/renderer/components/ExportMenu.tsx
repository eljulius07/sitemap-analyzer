import { useEffect, useRef, useState } from 'react'
import type { UrlResult } from '@shared/types'
import { useStore } from '../stores/analysisStore'
import { TAB_LABELS } from '../results/columns'
import { exportCsv, exportHtml, exportXlsx } from '../utils/export'

export function ExportMenu({ results }: { results: UrlResult[] }): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const activeTab = useStore((s) => s.activeTab)
  const source = useStore((s) => s.sitemapSource)
  const pushToast = useStore((s) => s.pushToast)

  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const run = async (fn: () => Promise<{ saved: boolean; path?: string; error?: string }>, label: string): Promise<void> => {
    setOpen(false)
    if (results.length === 0) {
      pushToast('info', 'Nothing to export.')
      return
    }
    pushToast('info', `Generating ${label}…`)
    try {
      const res = await fn()
      if (res.saved) pushToast('success', `Saved to ${res.path}`)
      else if (res.error) pushToast('error', res.error)
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : String(err))
    }
  }

  const items: { label: string; action: () => void }[] = [
    { label: 'Export All Data (CSV)', action: () => void run(() => exportCsv(results, 'all', activeTab), 'CSV') },
    { label: `Export Current Tab — ${TAB_LABELS[activeTab]} (CSV)`, action: () => void run(() => exportCsv(results, 'current-tab', activeTab), 'CSV') },
    { label: 'Export Excel Workbook (.xlsx)', action: () => void run(() => exportXlsx(results, source), 'Excel') },
    { label: 'Export HTML Report', action: () => void run(() => exportHtml(results, source), 'HTML') }
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-1.5 rounded-md text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 flex items-center gap-1.5"
      >
        Export
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor">
          <path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 rounded-lg border border-slate-200 bg-white shadow-lg z-30 py-1 dark:border-slate-700 dark:bg-slate-800">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={it.action}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
