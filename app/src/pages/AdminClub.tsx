import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthProvider'
import type { Profile } from '../lib/types'
import { errorMessage } from '../lib/errors'

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
    return <p className="text-amber-100/60">Only the club administrator can view this page.</p>
  }

  async function handleRegenerateCode() {
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('regenerate_invite_code')
      if (rpcError) throw rpcError
      await refresh()
    } catch (err) {
      setError(errorMessage(err))
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
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const inviteLink = club ? `${window.location.origin}/?code=${club.invite_code}` : ''

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-amber-500/20 bg-emerald-950/60 p-5 backdrop-blur-sm">
        <h2 className="font-display mb-2 text-lg font-bold text-amber-50">Invite players</h2>
        <p className="text-sm text-amber-100/60">
          Share this code or link with club members. When they join they pick a nickname, avatar
          and time zone — never an email or phone number.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded-lg border border-amber-400/30 bg-emerald-900/60 px-4 py-2 text-lg font-bold tracking-widest text-amber-300">
            {club?.invite_code}
          </code>
          <input
            readOnly
            value={inviteLink}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-2 text-sm text-amber-50"
          />
          <button
            onClick={handleRegenerateCode}
            disabled={busy}
            className="rounded-lg border border-amber-400/30 px-3 py-2 text-sm text-amber-100 hover:border-amber-400 hover:bg-amber-400/10"
          >
            Regenerate code
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-500/20 bg-emerald-950/60 p-5 backdrop-blur-sm">
        <h2 className="font-display mb-2 text-lg font-bold text-amber-50">Create tournament</h2>
        <form onSubmit={handleCreateTournament} className="flex flex-wrap gap-3">
          <input
            required
            value={tournamentName}
            onChange={(e) => setTournamentName(e.target.value)}
            placeholder="e.g. Spring Knockout 2026"
            className="min-w-0 flex-1 rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-2 text-amber-50 placeholder:text-amber-100/30 focus:border-amber-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-2 font-semibold text-emerald-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-50"
          >
            Create
          </button>
        </form>
        <p className="mt-2 text-xs text-amber-100/50">
          After creating it you'll be able to pick participants and generate the bracket at random.
        </p>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <section>
        <h2 className="font-display mb-2 text-lg font-bold text-amber-50">Club members ({members.length})</h2>
        {loading ? (
          <p className="text-amber-100/60">Loading…</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-lg border border-amber-500/15 bg-emerald-950/50 px-3 py-2 text-sm backdrop-blur-sm"
              >
                <span className="text-lg">{m.avatar_url}</span>
                <span className="font-medium text-amber-50">{m.nickname}</span>
                {m.is_admin && (
                  <span className="ml-auto rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs text-amber-300">
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
