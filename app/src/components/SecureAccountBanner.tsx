import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'

export function SecureAccountBanner() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email: email.trim() })
      if (updateError) throw updateError
      setSent(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-4">
        <div className="rounded-xl border border-lime-400/30 bg-lime-400/5 px-4 py-3 text-sm text-amber-50">
          Check <strong>{email}</strong> and click the confirmation link to finish securing your account.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm"
      >
        <span className="text-amber-100/80">
          You're signed in anonymously — add an email so you never lose access to your profile.
        </span>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-lg border border-emerald-700/60 bg-emerald-950/70 px-3 py-1.5 text-amber-50 placeholder:text-amber-100/30 focus:border-amber-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-gradient-to-b from-lime-400 to-green-600 px-3 py-1.5 font-semibold text-emerald-950 hover:from-lime-300 hover:to-green-500 disabled:opacity-50"
        >
          Secure account
        </button>
        {error && <p className="w-full text-red-400">{error}</p>}
      </form>
    </div>
  )
}
