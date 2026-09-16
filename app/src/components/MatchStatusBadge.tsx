import type { MatchStatus } from '../lib/types'

const LABELS: Record<MatchStatus, string> = {
  pending: 'Coordinar horario',
  scheduled: 'Programado',
  awaiting_confirmation: 'Confirmar resultado',
  completed: 'Completado',
  bye: 'Bye',
}

const STYLES: Record<MatchStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  scheduled: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  awaiting_confirmation: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  bye: 'bg-slate-500/10 text-slate-500',
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  )
}
