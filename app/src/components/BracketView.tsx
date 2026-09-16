import { Link } from 'react-router-dom'
import type { Match } from '../lib/types'
import { MatchStatusBadge } from './MatchStatusBadge'

type MatchWithPlayers = Match & {
  player1: { nickname: string; avatar_url: string | null } | null
  player2: { nickname: string; avatar_url: string | null } | null
}

export function BracketView({ matches, meId }: { matches: MatchWithPlayers[]; meId?: string }) {
  const rounds = Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b)

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {rounds.map((round) => (
        <div key={round} className="flex min-w-[220px] flex-col gap-4">
          <h3 className="text-center text-sm font-bold uppercase tracking-wide text-slate-500">
            {roundLabel(round, rounds.length)}
          </h3>
          {matches
            .filter((m) => m.round === round)
            .sort((a, b) => a.slot_in_round - b.slot_in_round)
            .map((m) => (
              <Link
                key={m.id}
                to={`/match/${m.id}`}
                className={`flex flex-col gap-2 rounded-xl border px-3 py-2 text-sm transition hover:border-emerald-500 ${
                  meId && (m.player1_id === meId || m.player2_id === meId)
                    ? 'border-emerald-400 bg-emerald-500/5'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <PlayerRow player={m.player1} isWinner={m.winner_id === m.player1_id} />
                <PlayerRow player={m.player2} isWinner={m.winner_id === m.player2_id} bye={!m.player2_id} />
                <MatchStatusBadge status={m.status} />
              </Link>
            ))}
        </div>
      ))}
    </div>
  )
}

function PlayerRow({
  player,
  isWinner,
  bye,
}: {
  player: { nickname: string; avatar_url: string | null } | null
  isWinner: boolean
  bye?: boolean
}) {
  return (
    <div className={`flex items-center gap-2 ${isWinner ? 'font-bold' : ''}`}>
      <span>{player?.avatar_url ?? '❔'}</span>
      <span className="truncate">{bye ? 'Bye' : (player?.nickname ?? 'Por definir')}</span>
      {isWinner && <span className="ml-auto text-emerald-500">🏆</span>}
    </div>
  )
}

function roundLabel(round: number, totalRounds: number): string {
  const remaining = totalRounds - round
  if (remaining === 0) return 'Final'
  if (remaining === 1) return 'Semifinal'
  if (remaining === 2) return 'Cuartos de final'
  return `Ronda ${round}`
}
