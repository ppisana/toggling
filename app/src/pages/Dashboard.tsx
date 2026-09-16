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

  if (loading) return <p className="text-slate-400">Cargando…</p>

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-lg font-bold">Mis partidos</h2>
        {myMatches.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no tenés cruces asignados.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {myMatches.map((m) => {
              const opponent = m.player1_id === profile?.id ? m.player2 : m.player1
              return (
                <Link
                  key={m.id}
                  to={`/match/${m.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 hover:border-emerald-500 dark:border-slate-800"
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {m.tournaments?.name} · Ronda {m.round}
                    </p>
                    <p className="font-semibold">
                      {opponent ? `${opponent.avatar_url} ${opponent.nickname}` : 'Bye (avanzás directo)'}
                    </p>
                    {m.scheduled_at && (
                      <p className="text-xs text-slate-500">{formatLocal(m.scheduled_at)}</p>
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
        <h2 className="mb-3 text-lg font-bold">Torneos de {club?.name}</h2>
        {tournaments.length === 0 ? (
          <p className="text-sm text-slate-500">
            Todavía no hay torneos. {profile?.is_admin ? 'Creá uno desde Administrar.' : 'Esperá a que la administradora organice uno.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {tournaments.map((t) => (
              <Link
                key={t.id}
                to={`/tournament/${t.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 hover:border-emerald-500 dark:border-slate-800"
              >
                <span className="font-semibold">{t.name}</span>
                <span className="text-xs uppercase tracking-wide text-slate-500">{t.status}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
