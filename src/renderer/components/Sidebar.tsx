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

      <a
        href="https://github.com/eljulius07/sitemap-analyzer"
        rel="noreferrer"
        title="View on GitHub — @eljulius07"
        className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
        <span className="truncate">@eljulius07</span>
      </a>
    </aside>
  )
}
