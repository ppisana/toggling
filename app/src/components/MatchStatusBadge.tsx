import type { MatchStatus } from '../lib/types'

const LABELS: Record<MatchStatus, string> = {
  pending: 'Schedule match',
  scheduled: 'Scheduled',
  awaiting_confirmation: 'Confirm result',
  completed: 'Completed',
  bye: 'Bye',
}

const STYLES: Record<MatchStatus, string> = {
  pending: 'bg-amber-400/15 text-amber-300 border border-amber-400/30',
  scheduled: 'bg-sky-400/15 text-sky-300 border border-sky-400/30',
  awaiting_confirmation: 'bg-purple-400/15 text-purple-300 border border-purple-400/30',
  completed: 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30',
  bye: 'bg-amber-100/10 text-amber-100/60 border border-amber-100/20',
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  )
}
