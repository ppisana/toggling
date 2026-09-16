import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthProvider'
import type { Profile } from '../lib/types'

export function AdminClub() {
  const { profile, club, refresh } = useAuth()
  const navigate = useNavigate()
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tournamentName, setTournamentName] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('nickname', { ascending: true })
      if (!cancelled) {
        setMembers((data as Profile[]) ?? [])
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (!profile?.is_admin) {
    return <p className="text-slate-500">Solo la administradora puede ver esta página.</p>
  }

  async function handleRegenerateCode() {
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('regenerate_invite_code')
      if (rpcError) throw rpcError
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo regenerar el código')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateTournament(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('create_tournament', {
        p_name: tournamentName.trim(),
      })
      if (rpcError) throw rpcError
      setTournamentName('')
      navigate(`/tournament/${data as string}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el torneo')
    } finally {
      setBusy(false)
    }
  }

  const inviteLink = club ? `${window.location.origin}/?code=${club.invite_code}` : ''

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-2 text-lg font-bold">Invitar jugadores</h2>
        <p className="text-sm text-slate-500">
          Compartí este código o link con los socios del club. Al entrar eligen su nickname, avatar
          y huso horario — nunca piden mail ni teléfono.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-slate-100 px-4 py-2 text-lg font-bold tracking-widest dark:bg-slate-800">
            {club?.invite_code}
          </code>
          <input
            readOnly
            value={inviteLink}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <button
            onClick={handleRegenerateCode}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:border-emerald-500 dark:border-slate-700"
          >
            Regenerar código
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Crear torneo</h2>
        <form onSubmit={handleCreateTournament} className="flex flex-wrap gap-3">
          <input
            required
            value={tournamentName}
            onChange={(e) => setTournamentName(e.target.value)}
            placeholder="Ej: Knock-out Primavera 2026"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Crear
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Después de crearlo vas a poder elegir los participantes y generar el cuadro de forma
          aleatoria.
        </p>
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <section>
        <h2 className="mb-2 text-lg font-bold">Socios del club ({members.length})</h2>
        {loading ? (
          <p className="text-slate-400">Cargando…</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
              >
                <span className="text-lg">{m.avatar_url}</span>
                <span className="font-medium">{m.nickname}</span>
                {m.is_admin && (
                  <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">
                    Admin
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
