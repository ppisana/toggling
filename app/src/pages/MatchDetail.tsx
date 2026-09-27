import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthProvider'
import type { Match, MatchMessage, MatchProposal } from '../lib/types'
import { MatchStatusBadge } from '../components/MatchStatusBadge'
import { formatInZone, localInputToUtcIso, minDateTimeLocal } from '../lib/dates'
import { Chat } from '../components/Chat'
import { errorMessage } from '../lib/errors'
import { formatMatchPlayScore, formatMatchScore, formatStrokeToPar } from '../lib/golfScore'
import type { ScoreType } from '../lib/types'

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
  const [reportWinnerId, setReportWinnerId] = useState<string | null>(null)
  const [scoreType, setScoreType] = useState<ScoreType>('match_play')
  const [holesUp, setHolesUp] = useState('')
  const [holesRemaining, setHolesRemaining] = useState('')
  const [player1Score, setPlayer1Score] = useState('')
  const [player2Score, setPlayer2Score] = useState('')

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

  if (loading) return <p className="text-amber-100/60">Loading…</p>
  if (!match) return <p className="text-amber-100/60">Match not found.</p>

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
      setError(errorMessage(err))
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
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function submitResult(e: React.FormEvent) {
    e.preventDefault()
    if (!reportWinnerId) return
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('report_match_result', {
        p_match_id: matchId,
        p_winner_id: reportWinnerId,
        p_score_type: scoreType,
        p_match_play_holes_up: scoreType === 'match_play' ? Number(holesUp) : null,
        p_match_play_holes_remaining: scoreType === 'match_play' ? Number(holesRemaining) : null,
        p_player1_score_to_par: scoreType === 'stroke_play' ? Number(player1Score) : null,
        p_player2_score_to_par: scoreType === 'stroke_play' ? Number(player2Score) : null,
      })
      if (rpcError) throw rpcError
      setReportWinnerId(null)
      setHolesUp('')
      setHolesRemaining('')
      setPlayer1Score('')
      setPlayer2Score('')
      await load()
    } catch (err) {
      setError(errorMessage(err))
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
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const pendingProposals = proposals.filter((p) => p.status === 'pending')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-amber-100/50">
          {match.tournaments?.name} · Round {match.round}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <PlayerChip player={match.player1} highlight={match.winner_id === match.player1_id} />
          <span className="text-amber-100/40">vs</span>
          <PlayerChip player={match.player2} highlight={match.winner_id === match.player2_id} bye={!match.player2_id} />
        </div>
        <div className="mt-2">
          <MatchStatusBadge status={match.status} />
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {match.status === 'bye' && (
        <p className="text-sm text-amber-100/60">This match advanced straight to the next round.</p>
      )}

      {match.status === 'scheduled' && match.scheduled_at && (
        <section className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
          <h2 className="font-bold text-amber-50">Confirmed time</h2>
          <p className="text-sm text-amber-100/80">
            {match.player1?.nickname}: {formatInZone(match.scheduled_at, match.player1?.timezone ?? 'UTC')}
          </p>
          <p className="text-sm text-amber-100/80">
            {match.player2?.nickname}: {formatInZone(match.scheduled_at, match.player2?.timezone ?? 'UTC')}
          </p>
        </section>
      )}

      {isParticipant && (match.status === 'pending' || match.status === 'scheduled') && (
        <section className="rounded-2xl border border-amber-500/20 bg-emerald-950/90 p-4 backdrop-blur-sm">
          <h2 className="mb-2 font-bold text-amber-50">Propose a time</h2>
          <form onSubmit={submitProposal} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-amber-100/80">
              Date and time (your local time)
              <input
                required
                type="datetime-local"
                min={minDateTimeLocal()}
                value={proposedLocal}
                onChange={(e) => setProposedLocal(e.target.value)}
                className="rounded-lg border border-emerald-700/60 bg-emerald-950/70 px-3 py-2 text-amber-50 focus:border-amber-400 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !proposedLocal}
              className="rounded-lg bg-gradient-to-b from-lime-400 to-green-600 px-4 py-2 font-semibold text-emerald-950 hover:from-lime-300 hover:to-green-500 disabled:opacity-50"
            >
              Propose
            </button>
          </form>
          {proposedLocal && opponent && (
            <p className="mt-2 text-xs text-amber-100/50">
              For {opponent.nickname} that would be:{' '}
              {formatInZone(localInputToUtcIso(proposedLocal), opponent.timezone)}
            </p>
          )}
        </section>
      )}

      {pendingProposals.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold text-amber-50">Proposed times</h2>
          <div className="flex flex-col gap-2">
            {pendingProposals.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/15 bg-emerald-950/85 px-4 py-3 backdrop-blur-sm"
              >
                <div>
                  <p className="text-sm font-medium text-amber-50">Proposed by {p.proposed_by_profile?.nickname}</p>
                  <p className="text-xs text-amber-100/50">
                    {match.player1?.nickname}: {formatInZone(p.proposed_at, match.player1?.timezone ?? 'UTC')}
                  </p>
                  <p className="text-xs text-amber-100/50">
                    {match.player2?.nickname}: {formatInZone(p.proposed_at, match.player2?.timezone ?? 'UTC')}
                  </p>
                </div>
                {isParticipant && p.proposed_by !== profile?.id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => respond(p.id, true)}
                      disabled={busy}
                      className="rounded-lg bg-gradient-to-b from-lime-400 to-green-600 px-3 py-1.5 text-sm font-semibold text-emerald-950 hover:from-lime-300 hover:to-green-500"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respond(p.id, false)}
                      disabled={busy}
                      className="rounded-lg border border-amber-400/30 px-3 py-1.5 text-sm text-amber-100 hover:border-red-400/60 hover:text-red-300"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {isParticipant && match.status === 'scheduled' && match.player1 && match.player2 && (
        <section className="rounded-2xl border border-amber-500/20 bg-emerald-950/90 p-4 backdrop-blur-sm">
          <h2 className="mb-2 font-bold text-amber-50">Report result</h2>
          <form onSubmit={submitResult} className="flex flex-col gap-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setReportWinnerId(match.player1!.id)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  reportWinnerId === match.player1.id
                    ? 'border-amber-400 bg-amber-400/10 text-amber-50'
                    : 'border-amber-400/30 text-amber-100 hover:border-amber-400'
                }`}
              >
                {match.player1.nickname} won
              </button>
              <button
                type="button"
                onClick={() => setReportWinnerId(match.player2!.id)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  reportWinnerId === match.player2.id
                    ? 'border-amber-400 bg-amber-400/10 text-amber-50'
                    : 'border-amber-400/30 text-amber-100 hover:border-amber-400'
                }`}
              >
                {match.player2.nickname} won
              </button>
            </div>

            <div className="flex gap-4 text-sm text-amber-100/80">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={scoreType === 'match_play'}
                  onChange={() => setScoreType('match_play')}
                />
                Match play
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={scoreType === 'stroke_play'}
                  onChange={() => setScoreType('stroke_play')}
                />
                Stroke play
              </label>
            </div>

            {scoreType === 'match_play' ? (
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm text-amber-100/80">
                  Holes up
                  <input
                    required
                    type="number"
                    min={1}
                    max={9}
                    value={holesUp}
                    onChange={(e) => setHolesUp(e.target.value)}
                    className="w-24 rounded-lg border border-emerald-700/60 bg-emerald-950/70 px-3 py-2 text-amber-50 focus:border-amber-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-amber-100/80">
                  Holes remaining
                  <input
                    required
                    type="number"
                    min={0}
                    max={8}
                    value={holesRemaining}
                    onChange={(e) => setHolesRemaining(e.target.value)}
                    className="w-28 rounded-lg border border-emerald-700/60 bg-emerald-950/70 px-3 py-2 text-amber-50 focus:border-amber-400 focus:outline-none"
                  />
                </label>
                {holesUp !== '' && holesRemaining !== '' && (
                  <p className="pb-2 text-sm text-amber-100/50">
                    {formatMatchPlayScore(Number(holesUp), Number(holesRemaining))}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm text-amber-100/80">
                  {match.player1.nickname}'s score (to par)
                  <input
                    required
                    type="number"
                    value={player1Score}
                    onChange={(e) => setPlayer1Score(e.target.value)}
                    placeholder="e.g. -4"
                    className="w-28 rounded-lg border border-emerald-700/60 bg-emerald-950/70 px-3 py-2 text-amber-50 focus:border-amber-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-amber-100/80">
                  {match.player2.nickname}'s score (to par)
                  <input
                    required
                    type="number"
                    value={player2Score}
                    onChange={(e) => setPlayer2Score(e.target.value)}
                    placeholder="e.g. -1"
                    className="w-28 rounded-lg border border-emerald-700/60 bg-emerald-950/70 px-3 py-2 text-amber-50 focus:border-amber-400 focus:outline-none"
                  />
                </label>
                {player1Score !== '' && player2Score !== '' && (
                  <p className="pb-2 text-sm text-amber-100/50">
                    {formatStrokeToPar(Number(player1Score))} · {formatStrokeToPar(Number(player2Score))}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !reportWinnerId}
              className="self-start rounded-lg bg-gradient-to-b from-lime-400 to-green-600 px-4 py-2 text-sm font-semibold text-emerald-950 hover:from-lime-300 hover:to-green-500 disabled:opacity-50"
            >
              Submit result
            </button>
          </form>
        </section>
      )}

      {match.status === 'awaiting_confirmation' && (
        <section className="rounded-2xl border border-purple-400/30 bg-purple-400/5 p-4">
          <p className="text-sm text-amber-100/80">
            {match.reported_by === profile?.id
              ? 'You reported the result. Waiting for your opponent to confirm it.'
              : `Your opponent reported ${
                  match.reported_winner_id === match.player1_id ? match.player1?.nickname : match.player2?.nickname
                } as the winner.`}
            {formatMatchScore(match) && <span className="text-amber-100/50"> · {formatMatchScore(match)}</span>}
          </p>
          {isParticipant && match.reported_by !== profile?.id && (
            <button
              onClick={confirmResult}
              disabled={busy}
              className="mt-2 rounded-lg bg-gradient-to-b from-lime-400 to-green-600 px-4 py-2 text-sm font-semibold text-emerald-950 hover:from-lime-300 hover:to-green-500"
            >
              Confirm result
            </button>
          )}
        </section>
      )}

      {match.status === 'completed' && (
        <p className="font-semibold text-amber-300">
          🏆 {match.winner_id === match.player1_id ? match.player1?.nickname : match.player2?.nickname} won
          {formatMatchScore(match) && <span className="text-amber-100/60"> ({formatMatchScore(match)})</span>}
        </p>
      )}

      {isParticipant && match.player1 && match.player2 && (
        <section>
          <h2 className="mb-2 font-bold text-amber-50">Match chat</h2>
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
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${highlight ? 'border-amber-400/50 bg-amber-400/10' : 'border-amber-500/15 bg-emerald-950/85'}`}>
      <span className="text-xl">{player?.avatar_url ?? '❔'}</span>
      <span className="font-semibold text-amber-50">{bye ? 'Bye' : (player?.nickname ?? 'TBD')}</span>
    </div>
  )
}
