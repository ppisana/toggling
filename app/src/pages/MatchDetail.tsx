import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthProvider'
import type { Match, MatchMessage, MatchProposal } from '../lib/types'
import { MatchStatusBadge } from '../components/MatchStatusBadge'
import { formatInZone, localInputToUtcIso, minDateTimeLocal } from '../lib/dates'
import { Chat } from '../components/Chat'
import { errorMessage } from '../lib/errors'

type PlayerInfo = { id: string; nickname: string; avatar_url: string | null; timezone: string }
type MatchFull = Match & {
  player1: PlayerInfo | null
  player2: PlayerInfo | null
  tournaments: { name: string } | null
}
type ProposalWithAuthor = MatchProposal & { proposed_by_profile: { nickname: string } | null }

export function MatchDetail() {
  const { matchId } = useParams<{ matchId: string }>()
  const { profile } = useAuth()
  const [match, setMatch] = useState<MatchFull | null>(null)
  const [proposals, setProposals] = useState<ProposalWithAuthor[]>([])
  const [messages, setMessages] = useState<MatchMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proposedLocal, setProposedLocal] = useState('')

  const load = useCallback(async () => {
    if (!matchId) return
    setLoading(true)
    const [{ data: matchRow }, { data: proposalRows }, { data: messageRows }] = await Promise.all([
      supabase
        .from('matches')
        .select(
          '*, player1:player1_id(id,nickname,avatar_url,timezone), player2:player2_id(id,nickname,avatar_url,timezone), tournaments(name)',
        )
        .eq('id', matchId)
        .maybeSingle(),
      supabase
        .from('match_proposals')
        .select('*, proposed_by_profile:proposed_by(nickname)')
        .eq('match_id', matchId)
        .order('created_at', { ascending: false }),
      supabase.from('match_messages').select('*').eq('match_id', matchId).order('created_at', { ascending: true }),
    ])
    setMatch((matchRow as unknown as MatchFull) ?? null)
    setProposals((proposalRows as unknown as ProposalWithAuthor[]) ?? [])
    setMessages((messageRows as MatchMessage[]) ?? [])
    setLoading(false)
  }, [matchId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!matchId) return
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_proposals', filter: `match_id=eq.${matchId}` },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId, load])

  const isParticipant = useMemo(
    () => !!profile && !!match && (match.player1_id === profile.id || match.player2_id === profile.id),
    [profile, match],
  )
  const opponent = useMemo(() => {
    if (!profile || !match) return null
    return match.player1_id === profile.id ? match.player2 : match.player1
  }, [profile, match])

  if (loading) return <p className="text-slate-400">Cargando…</p>
  if (!match) return <p className="text-slate-500">Partido no encontrado.</p>

  async function submitProposal(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const iso = localInputToUtcIso(proposedLocal)
      const { error: rpcError } = await supabase.rpc('propose_match_time', {
        p_match_id: matchId,
        p_proposed_at: iso,
      })
      if (rpcError) throw rpcError
      setProposedLocal('')
      await load()
    } catch (err) {
      setError(errorMessage(err, 'No se pudo proponer el horario'))
    } finally {
      setBusy(false)
    }
  }

  async function respond(proposalId: string, accept: boolean) {
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('respond_to_proposal', {
        p_proposal_id: proposalId,
        p_accept: accept,
      })
      if (rpcError) throw rpcError
      await load()
    } catch (err) {
      setError(errorMessage(err, 'No se pudo responder la propuesta'))
    } finally {
      setBusy(false)
    }
  }

  async function reportWinner(winnerId: string) {
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('report_match_result', {
        p_match_id: matchId,
        p_winner_id: winnerId,
      })
      if (rpcError) throw rpcError
      await load()
    } catch (err) {
      setError(errorMessage(err, 'No se pudo reportar el resultado'))
    } finally {
      setBusy(false)
    }
  }

  async function confirmResult() {
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('confirm_match_result', { p_match_id: matchId })
      if (rpcError) throw rpcError
      await load()
    } catch (err) {
      setError(errorMessage(err, 'No se pudo confirmar el resultado'))
    } finally {
      setBusy(false)
    }
  }

  const pendingProposals = proposals.filter((p) => p.status === 'pending')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {match.tournaments?.name} · Ronda {match.round}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <PlayerChip player={match.player1} highlight={match.winner_id === match.player1_id} />
          <span className="text-slate-400">vs</span>
          <PlayerChip player={match.player2} highlight={match.winner_id === match.player2_id} bye={!match.player2_id} />
        </div>
        <div className="mt-2">
          <MatchStatusBadge status={match.status} />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {match.status === 'bye' && (
        <p className="text-sm text-slate-500">Este cruce pasó directo a la próxima ronda.</p>
      )}

      {match.status === 'scheduled' && match.scheduled_at && (
        <section className="rounded-xl border border-emerald-400 bg-emerald-500/5 p-4">
          <h2 className="font-bold">Horario confirmado</h2>
          <p className="text-sm">
            {match.player1?.nickname}: {formatInZone(match.scheduled_at, match.player1?.timezone ?? 'UTC')}
          </p>
          <p className="text-sm">
            {match.player2?.nickname}: {formatInZone(match.scheduled_at, match.player2?.timezone ?? 'UTC')}
          </p>
        </section>
      )}

      {isParticipant && (match.status === 'pending' || match.status === 'scheduled') && (
        <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="mb-2 font-bold">Proponer un horario</h2>
          <form onSubmit={submitProposal} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Fecha y hora (en tu horario local)
              <input
                required
                type="datetime-local"
                min={minDateTimeLocal()}
                value={proposedLocal}
                onChange={(e) => setProposedLocal(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !proposedLocal}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Proponer
            </button>
          </form>
          {proposedLocal && opponent && (
            <p className="mt-2 text-xs text-slate-500">
              Para {opponent.nickname} sería:{' '}
              {formatInZone(localInputToUtcIso(proposedLocal), opponent.timezone)}
            </p>
          )}
        </section>
      )}

      {pendingProposals.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold">Propuestas de horario</h2>
          <div className="flex flex-col gap-2">
            {pendingProposals.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800"
              >
                <div>
                  <p className="text-sm font-medium">Propuesto por {p.proposed_by_profile?.nickname}</p>
                  <p className="text-xs text-slate-500">
                    {match.player1?.nickname}: {formatInZone(p.proposed_at, match.player1?.timezone ?? 'UTC')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {match.player2?.nickname}: {formatInZone(p.proposed_at, match.player2?.timezone ?? 'UTC')}
                  </p>
                </div>
                {isParticipant && p.proposed_by !== profile?.id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => respond(p.id, true)}
                      disabled={busy}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500"
                    >
                      Aceptar
                    </button>
                    <button
                      onClick={() => respond(p.id, false)}
                      disabled={busy}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:border-red-400 dark:border-slate-700"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {isParticipant && match.status === 'scheduled' && match.player1 && match.player2 && (
        <section>
          <h2 className="mb-2 font-bold">Reportar resultado</h2>
          <div className="flex gap-3">
            <button
              onClick={() => reportWinner(match.player1!.id)}
              disabled={busy}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:border-emerald-500 dark:border-slate-700"
            >
              Ganó {match.player1.nickname}
            </button>
            <button
              onClick={() => reportWinner(match.player2!.id)}
              disabled={busy}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:border-emerald-500 dark:border-slate-700"
            >
              Ganó {match.player2.nickname}
            </button>
          </div>
        </section>
      )}

      {match.status === 'awaiting_confirmation' && (
        <section className="rounded-xl border border-purple-400 bg-purple-500/5 p-4">
          <p className="text-sm">
            {match.reported_by === profile?.id
              ? 'Reportaste el resultado. Esperando que tu rival lo confirme.'
              : `Tu rival reportó como ganador a ${
                  match.reported_winner_id === match.player1_id ? match.player1?.nickname : match.player2?.nickname
                }.`}
          </p>
          {isParticipant && match.reported_by !== profile?.id && (
            <button
              onClick={confirmResult}
              disabled={busy}
              className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Confirmar resultado
            </button>
          )}
        </section>
      )}

      {match.status === 'completed' && (
        <p className="font-semibold text-emerald-600">
          🏆 Ganó {match.winner_id === match.player1_id ? match.player1?.nickname : match.player2?.nickname}
        </p>
      )}

      {isParticipant && match.player1 && match.player2 && (
        <section>
          <h2 className="mb-2 font-bold">Chat del partido</h2>
          <Chat matchId={match.id} messages={messages} onMessagesChange={setMessages} />
        </section>
      )}
    </div>
  )
}

function PlayerChip({
  player,
  highlight,
  bye,
}: {
  player: PlayerInfo | null
  highlight: boolean
  bye?: boolean
}) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${highlight ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-200 dark:border-slate-800'}`}>
      <span className="text-xl">{player?.avatar_url ?? '❔'}</span>
      <span className="font-semibold">{bye ? 'Bye' : (player?.nickname ?? 'Por definir')}</span>
    </div>
  )
}
