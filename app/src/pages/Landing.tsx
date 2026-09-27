import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthProvider'
import { AvatarPicker } from '../components/AvatarPicker'
import { TimezoneSelect } from '../components/TimezoneSelect'
import { detectTimezone } from '../lib/timezones'
import { randomAvatar } from '../lib/avatars'
import { errorMessage } from '../lib/errors'
import { stashPendingSignup, clearPendingSignup } from '../lib/pendingSignup'

type Mode = 'choose' | 'create' | 'join' | 'confirm'

export function Landing() {
  const { session, refresh } = useAuth()
  // Already signed in (e.g. came back from the magic link, or the "secure
  // your account" flow left a session with no club yet) -- no need to collect
  // an email or send another link, just finish the club directly.
  const alreadySignedIn = !!session

  const [searchParams] = useSearchParams()
  const codeFromLink = searchParams.get('code')?.toUpperCase() ?? ''
  const [mode, setMode] = useState<Mode>(codeFromLink ? 'join' : 'choose')
  const [clubName, setClubName] = useState('')
  const [code, setCode] = useState(codeFromLink)
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [avatar, setAvatar] = useState(randomAvatar())
  const [timezone, setTimezone] = useState(detectTimezone())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCreate = mode === 'create'

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (alreadySignedIn) {
        const { error: rpcError } = isCreate
          ? await supabase.rpc('create_club', {
              p_name: clubName.trim(),
              p_nickname: nickname.trim(),
              p_avatar_url: avatar,
              p_timezone: timezone,
            })
          : await supabase.rpc('join_club', {
              p_code: code.trim().toUpperCase(),
              p_nickname: nickname.trim(),
              p_avatar_url: avatar,
              p_timezone: timezone,
            })
        if (rpcError) throw rpcError
        await refresh()
        return
      }

      stashPendingSignup(
        isCreate
          ? { kind: 'create', clubName: clubName.trim(), nickname: nickname.trim(), avatarUrl: avatar, timezone }
          : { kind: 'join', code: code.trim().toUpperCase(), nickname: nickname.trim(), avatarUrl: avatar, timezone },
      )
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      })
      if (otpError) throw otpError
      setMode('confirm')
    } catch (err) {
      clearPendingSignup()
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
            Run your Country Club's WGT knock-out tournaments across time zones — other players
            only ever see your nickname and avatar.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <button
            onClick={() => setMode('create')}
            className="rounded-xl bg-gradient-to-b from-lime-400 to-green-600 px-4 py-3 font-semibold text-emerald-950 shadow-lg shadow-black/30 hover:from-lime-300 hover:to-green-500"
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

  if (mode === 'confirm') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-5xl">📬</div>
        <h1 className="font-display text-2xl font-bold text-amber-50">Check your inbox</h1>
        <p className="text-amber-100/70">
          We sent a sign-in link to <strong className="text-amber-50">{email}</strong>. Open it on
          this device to finish {isCreate ? 'creating your club' : 'joining the club'}.
        </p>
        <p className="text-xs text-amber-100/50">
          This email is only used to sign you back in — it's never shown to other club members.
        </p>
        <button
          onClick={() => {
            clearPendingSignup()
            setMode(isCreate ? 'create' : 'join')
          }}
          className="mt-2 text-sm text-amber-100/60 hover:text-amber-300"
        >
          ← Use a different email
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => setMode('choose')} className="text-sm text-amber-100/60 hover:text-amber-300">
          ← Back
        </button>
        {alreadySignedIn && (
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-amber-100/60 hover:text-amber-300"
          >
            Not you? Sign out
          </button>
        )}
      </div>
      <div className="rounded-2xl border border-amber-500/20 bg-emerald-950/90 p-6 shadow-lg shadow-black/30 backdrop-blur-sm">
        <h1 className="font-display text-xl font-bold text-amber-50">
          {isCreate ? 'Start your Country Club' : 'Join a Country Club'}
        </h1>
        <form onSubmit={submitForm} className="mt-6 flex flex-col gap-4">
          {isCreate ? (
            <label className="flex flex-col gap-1 text-sm font-medium text-amber-100/80">
              Club name
              <input
                required
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="e.g. Fairway Hills Golf Club"
                className="rounded-lg border border-emerald-700/60 bg-emerald-950/70 px-3 py-2 text-amber-50 placeholder:text-amber-100/30 focus:border-amber-400 focus:outline-none"
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
                className="rounded-lg border border-emerald-700/60 bg-emerald-950/70 px-3 py-2 uppercase tracking-widest text-amber-50 placeholder:text-amber-100/30 focus:border-amber-400 focus:outline-none"
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
              className="rounded-lg border border-emerald-700/60 bg-emerald-950/70 px-3 py-2 text-amber-50 placeholder:text-amber-100/30 focus:border-amber-400 focus:outline-none"
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

          {!alreadySignedIn && (
            <label className="flex flex-col gap-1 text-sm font-medium text-amber-100/80">
              Your email (private — only used to sign you back in)
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-lg border border-emerald-700/60 bg-emerald-950/70 px-3 py-2 text-amber-50 placeholder:text-amber-100/30 focus:border-amber-400 focus:outline-none"
              />
            </label>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-xl bg-gradient-to-b from-lime-400 to-green-600 px-4 py-3 font-semibold text-emerald-950 shadow-lg shadow-black/30 hover:from-lime-300 hover:to-green-500 disabled:opacity-50"
          >
            {busy ? 'One moment…' : alreadySignedIn ? (isCreate ? 'Create club' : 'Join') : 'Send me a sign-in link'}
          </button>
        </form>
      </div>
    </div>
  )
}
