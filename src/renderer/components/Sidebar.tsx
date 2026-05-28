import type { View } from '../stores/analysisStore'
import { useStore } from '../stores/analysisStore'

const items: { id: View; label: string; icon: JSX.Element }[] = [
  {
    id: 'home',
    label: 'Home',
    icon: (
      <path d="M3 11.5 12 4l9 7.5M5 10v10h14V10" strokeWidth="1.8" />
    )
  },
  {
    id: 'results',
    label: 'Results',
    icon: <path d="M4 6h16M4 12h16M4 18h16" strokeWidth="1.8" />
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.3 7.3 0 0 0-2-1.2L14.5 2h-5l-.4 2.5a7.3 7.3 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1c.6.5 1.3.9 2 1.2l.4 2.5h5l.4-2.5c.7-.3 1.4-.7 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z"
        strokeWidth="1.4"
      />
    )
  }
]

export function Sidebar(): JSX.Element {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const resultCount = useStore((s) => s.results.length)

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="px-5 py-5 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor">
            <path d="M4 5h16M4 12h10M4 19h16" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="font-semibold text-sm">Site</div>
          <div className="text-xs text-slate-500">Analyzer</div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {items.map((item) => {
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor">
                {item.icon}
              </svg>
              <span>{item.label}</span>
              {item.id === 'results' && resultCount > 0 && (
                <span
                  className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  {resultCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <button
        onClick={toggleTheme}
        className="m-3 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {theme === 'dark' ? (
          <>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="4" strokeWidth="1.8" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" strokeWidth="1.8" />
            </svg>
            Light mode
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" strokeWidth="1.8" />
            </svg>
            Dark mode
          </>
        )}
      </button>
    </aside>
  )
}
