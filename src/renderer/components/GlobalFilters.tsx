import { useStore, type SeverityFilter, type StatusGroup } from '../stores/analysisStore'

const STATUS_GROUPS: StatusGroup[] = ['2xx', '3xx', '4xx', '5xx', 'errors']
const SEVERITIES: { id: SeverityFilter; label: string }[] = [
  { id: 'critical', label: '🔴 Critical' },
  { id: 'warning', label: '⚠️ Warning' },
  { id: 'info', label: 'ℹ️ Info' },
  { id: 'none', label: '✅ Clean' }
]

export function GlobalFilters(): JSX.Element {
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const statusGroups = useStore((s) => s.statusGroups)
  const toggleStatusGroup = useStore((s) => s.toggleStatusGroup)
  const severities = useStore((s) => s.severities)
  const toggleSeverity = useStore((s) => s.toggleSeverity)
  const healthMin = useStore((s) => s.healthMin)
  const healthMax = useStore((s) => s.healthMax)
  const setHealthRange = useStore((s) => s.setHealthRange)

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search URL, title, issues…"
        className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-sm outline-none focus:border-brand-500 dark:border-slate-600 dark:bg-slate-900 w-60"
      />

      <div className="flex rounded-md overflow-hidden border border-slate-300 dark:border-slate-600">
        {STATUS_GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => toggleStatusGroup(g)}
            className={`px-2.5 py-1.5 text-xs font-medium ${
              statusGroups.has(g)
                ? 'bg-brand-600 text-white'
                : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5">
        {SEVERITIES.map((s) => (
          <button
            key={s.id}
            onClick={() => toggleSeverity(s.id)}
            className={`px-2.5 py-1.5 text-xs rounded-md border ${
              severities.has(s.id)
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>Health</span>
        <input
          type="number"
          min={0}
          max={100}
          value={healthMin}
          onChange={(e) => setHealthRange(Math.min(Number(e.target.value), healthMax), healthMax)}
          className="w-14 px-2 py-1 rounded border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
        />
        <span>–</span>
        <input
          type="number"
          min={0}
          max={100}
          value={healthMax}
          onChange={(e) => setHealthRange(healthMin, Math.max(Number(e.target.value), healthMin))}
          className="w-14 px-2 py-1 rounded border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
        />
      </div>
    </div>
  )
}
