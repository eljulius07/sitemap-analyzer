import { useStore } from '../stores/analysisStore'

export function ModeSelector(): JSX.Element {
  const inputMode = useStore((s) => s.inputMode)
  const setInputMode = useStore((s) => s.setInputMode)

  const tab = (mode: 'sitemap' | 'spider', icon: string, label: string): JSX.Element => {
    const active = inputMode === mode
    return (
      <button
        onClick={() => setInputMode(mode)}
        className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-colors ${
          active
            ? 'bg-brand-600 text-white shadow'
            : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
        }`}
      >
        <span>{icon}</span>
        {label}
      </button>
    )
  }

  return (
    <div className="flex gap-3 mb-8">
      {tab('sitemap', '📄', 'Sitemap Mode')}
      {tab('spider', '🕷️', 'Spider Mode')}
    </div>
  )
}
