export function formatMs(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number): string => n.toString().padStart(2, '0')
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${m}:${pad(s)}`
}

export function formatKb(kb: number | null): string {
  if (kb === null) return '—'
  if (kb >= 1024) return `${(kb / 1024).toFixed(2)} MB`
  return `${kb.toFixed(1)} KB`
}

export function statusColorClass(code: number | null): string {
  if (code === null) return 'text-rose-500'
  if (code >= 500) return 'text-rose-500'
  if (code >= 400) return 'text-orange-500'
  if (code >= 300) return 'text-amber-500'
  return 'text-emerald-500'
}

export function yesNo(v: boolean | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return v ? 'Yes' : 'No'
}

export function healthColorClass(score: number): string {
  if (score >= 90) return 'text-emerald-500'
  if (score >= 70) return 'text-lime-500'
  if (score >= 50) return 'text-amber-500'
  if (score >= 30) return 'text-orange-500'
  return 'text-rose-500'
}

export function healthStrokeColor(score: number): string {
  if (score >= 90) return '#10b981'
  if (score >= 70) return '#84cc16'
  if (score >= 50) return '#f59e0b'
  if (score >= 30) return '#f97316'
  return '#ef4444'
}
