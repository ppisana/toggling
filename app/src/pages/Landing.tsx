import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthProvider'
import { AvatarPicker } from '../components/AvatarPicker'
import { TimezoneSelect } from '../components/TimezoneSelect'
import { detectTimezone } from '../lib/timezones'
import { randomAvatar } from '../lib/avatars'
import { errorMessage } from '../lib/errors'

type Mode = 'choose' | 'create' | 'join'

export function Landing() {
  const [searchParams] = useSearchParams()
  const codeFromLink = searchParams.get('code')?.toUpperCase() ?? ''
  const [mode, setMode] = useState<Mode>(codeFromLink ? 'join' : 'choose')
  const [clubName, setClubName] = useState('')
  const [code, setCode] = useState(codeFromLink)
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState(randomAvatar())
  const [timezone, setTimezone] = useState(detectTimezone())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { refresh } = useAuth()
  const navigate = useNavigate()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('create_club', {
        p_name: clubName.trim(),
        p_nickname: nickname.trim(),
        p_avatar_url: avatar,
        p_timezone: timezone,
      })
      if (rpcError) throw rpcError
      await refresh()
      navigate('/club')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('join_club', {
        p_code: code.trim().toUpperCase(),
        p_nickname: nickname.trim(),
        p_avatar_url: avatar,
        p_timezone: timezone,
      })
      if (rpcError) throw rpcError
      await refresh()
      navigate('/club')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'choose') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 px-4 text-center">
        <div>
          <div className="text-5xl">⛳</div>
          <h1 className="font-display mt-4 text-3xl font-bold text-amber-50">Knockout Golf Scheduler</h1>
          <p className="mt-3 text-amber-100/70">
            Run your Country Club's WGT knock-out tournaments across time zones — no email, no
            phone number, just your nickname.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <button
            onClick={() => setMode('create')}
            className="rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-3 font-semibold text-emerald-950 shadow-lg shadow-black/30 hover:from-amber-300 hover:to-amber-500"
          >
            Start my Country Club
          </button>
          <button
            onClick={() => setMode('join')}
            className="rounded-xl border border-amber-400/30 px-4 py-3 font-semibold text-amber-100 hover:border-amber-400 hover:bg-amber-400/10"
          >
            Join with an invite code
          </button>
        </div>
      </div>
    )
  }

  const isCreate = mode === 'create'

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <button
        onClick={() => setMode('choose')}
        className="mb-4 self-start text-sm text-amber-100/60 hover:text-amber-300"
      >
        ← Back
      </button>
      <div className="rounded-2xl border border-amber-500/20 bg-emerald-950/60 p-6 shadow-lg shadow-black/30 backdrop-blur-sm">
        <h1 className="font-display text-xl font-bold text-amber-50">
          {isCreate ? 'Start your Country Club' : 'Join a Country Club'}
        </h1>
        <form onSubmit={isCreate ? handleCreate : handleJoin} className="mt-6 flex flex-col gap-4">
          {isCreate ? (
            <label className="flex flex-col gap-1 text-sm font-medium text-amber-100/80">
              Club name
              <input
                required
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="e.g. Fairway Hills Golf Club"
                className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-2 text-amber-50 placeholder:text-amber-100/30 focus:border-amber-400 focus:outline-none"
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-sm font-medium text-amber-100/80">
              Invite code
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. 7K2QXPZ"
                maxLength={7}
                className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-2 uppercase tracking-widest text-amber-50 placeholder:text-amber-100/30 focus:border-amber-400 focus:outline-none"
              />
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm font-medium text-amber-100/80">
            Your nickname (same as in WGT)
            <input
              required
              minLength={2}
              maxLength={32}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. BirdieHunter88"
              className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-2 text-amber-50 placeholder:text-amber-100/30 focus:border-amber-400 focus:outline-none"
            />
          </label>

          <div className="flex flex-col gap-1 text-sm font-medium text-amber-100/80">
            Pick your avatar
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-amber-100/80">
            Your time zone
            <TimezoneSelect value={timezone} onChange={setTimezone} />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-3 font-semibold text-emerald-950 shadow-lg shadow-black/30 hover:from-amber-300 hover:to-amber-500 disabled:opacity-50"
          >
            {busy ? 'One moment…' : isCreate ? 'Create club' : 'Join'}
          </button>
        </form>
      </div>
    </div>
  )
}
