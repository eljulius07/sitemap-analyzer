import { useStore } from '../stores/analysisStore'
import { DEFAULT_SETTINGS } from '@shared/types'

function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="py-4 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between gap-6">
        <div>
          <div className="text-sm font-medium">{label}</div>
          {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    </div>
  )
}

export function Settings(): JSX.Element {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const resetSettings = useStore((s) => s.resetSettings)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">Settings</h1>
          <button
            onClick={resetSettings}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Reset to defaults
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          These apply to the next analysis you run.
        </p>

        <Field label="Concurrency" hint={`Simultaneous requests (default ${DEFAULT_SETTINGS.concurrency})`}>
          <input
            type="number"
            min={1}
            max={50}
            value={settings.concurrency}
            onChange={(e) =>
              updateSettings({ concurrency: clamp(Number(e.target.value), 1, 50) })
            }
            className="w-24 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </Field>

        <Field label="Request Timeout (ms)" hint={`Per-request timeout (default ${DEFAULT_SETTINGS.timeoutMs})`}>
          <input
            type="number"
            min={1000}
            max={120000}
            step={1000}
            value={settings.timeoutMs}
            onChange={(e) =>
              updateSettings({ timeoutMs: clamp(Number(e.target.value), 1000, 120000) })
            }
            className="w-28 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </Field>

        <Field label="User-Agent" hint="Sent with every request">
          <input
            type="text"
            value={settings.userAgent}
            onChange={(e) => updateSettings({ userAgent: e.target.value })}
            className="w-80 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </Field>

        <Field label="Follow Redirects" hint="Record the full redirect chain (301 → 200)">
          <Toggle
            checked={settings.followRedirects}
            onChange={(v) => updateSettings({ followRedirects: v })}
          />
        </Field>

        <Field label="Retry Once on Failure" hint="Retry failed requests a single time before marking as error">
          <Toggle checked={settings.retryOnce} onChange={(v) => updateSettings({ retryOnce: v })} />
        </Field>

        <Field label="Theme" hint="Switch between light and dark appearance">
          <button
            onClick={toggleTheme}
            className="px-4 py-1.5 rounded-md text-sm border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </Field>
      </div>
    </div>
  )
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min
  return Math.min(max, Math.max(min, n))
}

function Toggle({
  checked,
  onChange
}: {
  checked: boolean
  onChange: (v: boolean) => void
}): JSX.Element {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition-colors relative ${
        checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
}
