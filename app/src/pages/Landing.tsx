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
      setError(errorMessage(err, 'Algo salió mal'))
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
      setError(errorMessage(err, 'Algo salió mal'))
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'choose') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
        <div>
          <div className="text-5xl">⛳</div>
          <h1 className="mt-3 text-2xl font-bold">Knockout Golf Scheduler</h1>
          <p className="mt-2 text-sm text-slate-500">
            Organizá torneos de knock-out de tu Country Club con jugadores en distintos husos
            horarios, sin compartir mail ni teléfono.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <button
            onClick={() => setMode('create')}
            className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white shadow hover:bg-emerald-500"
          >
            Crear mi Country Club
          </button>
          <button
            onClick={() => setMode('join')}
            className="rounded-xl border border-slate-300 px-4 py-3 font-semibold hover:border-emerald-500 dark:border-slate-700"
          >
            Unirme con un código de invitación
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
        className="mb-4 self-start text-sm text-slate-500 hover:text-emerald-600"
      >
        ← Volver
      </button>
      <h1 className="text-xl font-bold">
        {isCreate ? 'Crear tu Country Club' : 'Unirte a un Country Club'}
      </h1>
      <form onSubmit={isCreate ? handleCreate : handleJoin} className="mt-6 flex flex-col gap-4">
        {isCreate ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Nombre del club
            <input
              required
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              placeholder="Ej: Los Álamos Golf Club"
              className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Código de invitación
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ej: 7K2QXPZ"
              maxLength={7}
              className="rounded-lg border border-slate-300 px-3 py-2 uppercase tracking-widest dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium">
          Tu nickname (el mismo que en WGT)
          <input
            required
            minLength={2}
            maxLength={32}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Ej: BirdieHunter88"
            className="rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <div className="flex flex-col gap-1 text-sm font-medium">
          Elegí tu avatar
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Tu huso horario
          <TimezoneSelect value={timezone} onChange={setTimezone} />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? 'Un momento…' : isCreate ? 'Crear club' : 'Unirme'}
        </button>
      </form>
    </div>
  )
}
