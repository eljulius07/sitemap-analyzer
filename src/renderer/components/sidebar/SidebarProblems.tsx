import { useMemo } from 'react'
import type { UrlResult } from '@shared/types'
import { useStore } from '../../stores/analysisStore'
import { computeProblems, countBySeverity, type Problem } from '../../results/problems'

const SEV_DOT: Record<Problem['severity'], string> = {
  problem: 'bg-rose-500',
  warning: 'bg-amber-500',
  opportunity: 'bg-sky-500'
}
const SEV_LABEL: Record<Problem['severity'], string> = {
  problem: 'Problema',
  warning: 'Aviso',
  opportunity: 'Oportunidad'
}

export function SidebarProblems({ results }: { results: UrlResult[] }): JSX.Element {
  const selectedId = useStore((s) => s.selectedProblemId)
  const setSelected = useStore((s) => s.setSelectedProblem)
  const setActive = useStore((s) => s.setActiveProblem)
  const setTab = useStore((s) => s.setTab)
  const selectUrl = useStore((s) => s.selectUrl)

  const problems = useMemo(() => computeProblems(results), [results])
  const counts = useMemo(() => countBySeverity(problems), [problems])
  const selected = useMemo(() => problems.find((p) => p.id === selectedId) ?? null, [problems, selectedId])

  const handleClick = (p: Problem): void => {
    setSelected(p.id)
    setActive({ id: p.id, name: p.name, category: p.category, urls: new Set(p.affectedUrls) })
    setTab(p.category)
    // Close any URL detail so the user can see the table results.
    selectUrl(null)
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Counts */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] shrink-0">
        <span className="whitespace-nowrap">
          <span className="text-rose-500">●</span>{' '}
          <span className="text-slate-500">Problemas:</span>{' '}
          <span className="font-semibold tabular-nums">{counts.problem}</span>
        </span>
        <span className="whitespace-nowrap">
          <span className="text-amber-500">●</span>{' '}
          <span className="text-slate-500">Advertencias:</span>{' '}
          <span className="font-semibold tabular-nums">{counts.warning}</span>
        </span>
        <span className="whitespace-nowrap">
          <span className="text-sky-500">●</span>{' '}
          <span className="text-slate-500">Oportunidades:</span>{' '}
          <span className="font-semibold tabular-nums">{counts.opportunity}</span>
        </span>
        <span className="ml-auto whitespace-nowrap">
          <span className="text-slate-500">Total:</span>{' '}
          <span className="font-semibold tabular-nums">{problems.length}</span>
        </span>
      </div>

      {/* Problems table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {problems.length === 0 ? (
          <div className="p-6 text-center text-xs text-emerald-500">🎉 Sin problemas detectados.</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 z-10">
              <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                <th className="text-left font-medium px-2 py-1.5">Nombre</th>
                <th className="text-left font-medium px-1 py-1.5 w-16">Tipo</th>
                <th className="text-right font-medium px-1 py-1.5 w-10 tabular-nums">URL</th>
                <th className="text-right font-medium px-2 py-1.5 w-12 tabular-nums">%</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((p) => {
                const active = p.id === selectedId
                return (
                  <tr
                    key={p.id}
                    onClick={() => handleClick(p)}
                    className={`cursor-pointer border-b border-slate-100 dark:border-slate-800 ${
                      active
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="px-2 py-1.5 truncate max-w-[160px]" title={p.name}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${SEV_DOT[p.severity]}`} />
                      {p.name}
                    </td>
                    <td className="px-1 py-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                      {SEV_LABEL[p.severity]}
                    </td>
                    <td className="px-1 py-1.5 text-right tabular-nums">{p.urlCount.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{p.percentage}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Selected problem detail */}
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 max-h-[45%] overflow-auto">
        {selected ? (
          <div className="p-3 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
                Detalles del problema
              </div>
              <div className="font-semibold text-xs">{selected.name}</div>
              <div className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                {selected.urlCount.toLocaleString()} URL{selected.urlCount === 1 ? '' : 's'} · {selected.percentage}%
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">Descripción</div>
              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{selected.description}</p>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">Cómo solucionar</div>
              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{selected.howToFix}</p>
            </div>
          </div>
        ) : (
          <div className="px-3 py-4 text-[11px] text-slate-400 italic text-center">
            Selecciona un problema para ver su descripción y cómo solucionarlo.
          </div>
        )}
      </div>
    </div>
  )
}
