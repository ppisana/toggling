import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthProvider'
import type { Match, Profile, Tournament } from '../lib/types'
import { BracketView } from '../components/BracketView'
import { errorMessage } from '../lib/errors'

type MatchWithPlayers = Match & {
  player1: { nickname: string; avatar_url: string | null } | null
  player2: { nickname: string; avatar_url: string | null } | null
}

export function TournamentView() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const { profile } = useAuth()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<MatchWithPlayers[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!tournamentId) return
    setLoading(true)
    const [{ data: tournamentRow }, { data: matchRows }, { data: memberRows }] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', tournamentId).maybeSingle(),
      supabase
        .from('matches')
        .select('*, player1:player1_id(nickname,avatar_url), player2:player2_id(nickname,avatar_url)')
        .eq('tournament_id', tournamentId),
      supabase.from('profiles').select('*').order('nickname', { ascending: true }),
    ])
    setTournament((tournamentRow as Tournament) ?? null)
    setMatches((matchRows as unknown as MatchWithPlayers[]) ?? [])
    const memberList = (memberRows as Profile[]) ?? []
    setMembers(memberList)
    setSelected(new Set(memberList.map((m) => m.id)))
    setLoading(false)
  }, [tournamentId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="text-amber-100/60">Loading…</p>
  if (!tournament) return <p className="text-amber-100/60">Tournament not found.</p>

  const rounds = matches.map((m) => m.round)
  const currentRound = rounds.length ? Math.max(...rounds) : 0
  const currentRoundMatches = matches.filter((m) => m.round === currentRound)
  const currentRoundDone =
    currentRoundMatches.length > 0 &&
    currentRoundMatches.every((m) => m.status === 'completed' || m.status === 'bye')
  const isFinalDone = currentRoundDone && currentRoundMatches.length === 1

  async function handleGenerateBracket() {
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('generate_bracket', {
        p_tournament_id: tournamentId,
        p_player_ids: Array.from(selected),
      })
      if (rpcError) throw rpcError
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleAdvanceRound() {
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('advance_round', {
        p_tournament_id: tournamentId,
      })
      if (rpcError) throw rpcError
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function toggleMember(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-bold text-amber-50">{tournament.name}</h1>
        <p className="text-sm uppercase tracking-wide text-amber-100/50">{tournament.status}</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {tournament.status === 'draft' && (
        <section className="rounded-2xl border border-amber-500/20 bg-emerald-950/60 p-4 backdrop-blur-sm">
          <h2 className="mb-3 font-bold text-amber-50">Pick participants ({selected.size})</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {members.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2 rounded-lg border border-amber-500/15 bg-emerald-900/30 px-2 py-1.5 text-sm text-amber-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(m.id)}
                  onChange={() => toggleMember(m.id)}
                />
                <span>{m.avatar_url}</span>
                <span className="truncate">{m.nickname}</span>
              </label>
            ))}
          </div>
          {profile?.is_admin ? (
            <button
              onClick={handleGenerateBracket}
              disabled={busy || selected.size < 2}
              className="mt-4 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-2 font-semibold text-emerald-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-50"
            >
              Generate random bracket
            </button>
          ) : (
            <p className="mt-3 text-sm text-amber-100/60">Waiting for the administrator to generate the bracket.</p>
          )}
        </section>
      )}

      {matches.length > 0 && <BracketView matches={matches} meId={profile?.id} />}

      {profile?.is_admin && tournament.status === 'active' && currentRoundDone && !isFinalDone && (
        <button
          onClick={handleAdvanceRound}
          disabled={busy}
          className="self-start rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-2 font-semibold text-emerald-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-50"
        >
          Generate next round
        </button>
      )}

      {isFinalDone && <p className="font-semibold text-amber-300">🏆 Tournament complete!</p>}
    </div>
  )
}
