import { useStore } from '../stores/analysisStore'

const styles: Record<string, string> = {
  info: 'bg-slate-800 text-white',
  success: 'bg-emerald-600 text-white',
  error: 'bg-rose-600 text-white'
}

export function Toasts(): JSX.Element {
  const toasts = useStore((s) => s.toasts)
  const dismissToast = useStore((s) => s.dismissToast)

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-sm flex items-start gap-3 ${styles[t.kind]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismissToast(t.id)} className="opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
