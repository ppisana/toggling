import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthProvider'
import type { Match, Tournament } from '../lib/types'
import { MatchStatusBadge } from '../components/MatchStatusBadge'
import { formatLocal } from '../lib/dates'

type MatchWithPlayers = Match & {
  player1: { nickname: string; avatar_url: string | null } | null
  player2: { nickname: string; avatar_url: string | null } | null
  tournaments: { name: string } | null
}

export function Dashboard() {
  const { profile, club } = useAuth()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [myMatches, setMyMatches] = useState<MatchWithPlayers[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [{ data: tournamentRows }, { data: matchRows }] = await Promise.all([
        supabase
          .from('tournaments')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('matches')
          .select(
            '*, player1:player1_id(nickname,avatar_url), player2:player2_id(nickname,avatar_url), tournaments(name)',
          )
          .or(`player1_id.eq.${profile?.id},player2_id.eq.${profile?.id}`)
          .order('created_at', { ascending: false }),
      ])
      if (!cancelled) {
        setTournaments((tournamentRows as Tournament[]) ?? [])
        setMyMatches((matchRows as unknown as MatchWithPlayers[]) ?? [])
        setLoading(false)
      }
    }
    if (profile) load()
    return () => {
      cancelled = true
    }
  }, [profile])

  if (loading) return <p className="text-amber-100/60">Loading…</p>

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-display mb-3 text-lg font-bold text-amber-50">My matches</h2>
        {myMatches.length === 0 ? (
          <p className="text-sm text-amber-100/60">You don't have any matches assigned yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {myMatches.map((m) => {
              const opponent = m.player1_id === profile?.id ? m.player2 : m.player1
              return (
                <Link
                  key={m.id}
                  to={`/match/${m.id}`}
                  className="flex items-center justify-between rounded-xl border border-amber-500/15 bg-emerald-950/50 px-4 py-3 backdrop-blur-sm hover:border-amber-400/50"
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-amber-100/50">
                      {m.tournaments?.name} · Round {m.round}
                    </p>
                    <p className="font-semibold text-amber-50">
                      {opponent ? `${opponent.avatar_url} ${opponent.nickname}` : 'Bye (you advance automatically)'}
                    </p>
                    {m.scheduled_at && (
                      <p className="text-xs text-amber-100/50">{formatLocal(m.scheduled_at)}</p>
                    )}
                  </div>
                  <MatchStatusBadge status={m.status} />
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display mb-3 text-lg font-bold text-amber-50">{club?.name} tournaments</h2>
        {tournaments.length === 0 ? (
          <p className="text-sm text-amber-100/60">
            No tournaments yet. {profile?.is_admin ? 'Create one from Manage.' : 'Wait for the administrator to set one up.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {tournaments.map((t) => (
              <Link
                key={t.id}
                to={`/tournament/${t.id}`}
                className="flex items-center justify-between rounded-xl border border-amber-500/15 bg-emerald-950/50 px-4 py-3 backdrop-blur-sm hover:border-amber-400/50"
              >
                <span className="font-semibold text-amber-50">{t.name}</span>
                <span className="text-xs uppercase tracking-wide text-amber-100/50">{t.status}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
