import { supabase } from './supabase'

type PendingSignup =
  | { kind: 'create'; clubName: string; nickname: string; avatarUrl: string; timezone: string; stashedAt: number }
  | { kind: 'join'; code: string; nickname: string; avatarUrl: string; timezone: string; stashedAt: number }

// Plain `Omit` doesn't distribute over a union -- it collapses `PendingSignup`
// into the intersection of its members' keys first, so `clubName`/`code`
// disappear. This variant applies `Omit` to each member individually.
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

const KEY = 'kgs-pending-signup'
const MAX_AGE_MS = 30 * 60 * 1000 // magic links are typically valid ~1h; don't replay a stale stash forever

// localStorage (not sessionStorage) because the magic-link email usually opens
// in a brand-new tab, which doesn't share sessionStorage with the tab that sent it.
export function stashPendingSignup(payload: DistributiveOmit<PendingSignup, 'stashedAt'>) {
  localStorage.setItem(KEY, JSON.stringify({ ...payload, stashedAt: Date.now() }))
}

export function clearPendingSignup() {
  localStorage.removeItem(KEY)
}

/** After a magic-link verification leaves the user authenticated but with no
 * profile yet, finish the club they were creating/joining before the email
 * round-trip. No-ops if there's nothing stashed. */
export async function consumePendingSignup(): Promise<void> {
  const raw = localStorage.getItem(KEY)
  if (!raw) return
  clearPendingSignup()

  const payload = JSON.parse(raw) as PendingSignup
  if (Date.now() - payload.stashedAt > MAX_AGE_MS) return

  const { error } =
    payload.kind === 'create'
      ? await supabase.rpc('create_club', {
          p_name: payload.clubName,
          p_nickname: payload.nickname,
          p_avatar_url: payload.avatarUrl,
          p_timezone: payload.timezone,
        })
      : await supabase.rpc('join_club', {
          p_code: payload.code,
          p_nickname: payload.nickname,
          p_avatar_url: payload.avatarUrl,
          p_timezone: payload.timezone,
        })

  if (error) {
    // The same magic link can be opened in two tabs (or trigger two
    // overlapping auth events), so two callers can both race to consume this
    // stash. Whichever loses the race hits our own "you already belong to a
    // club" guard -- that's not a real failure, the other caller already
    // finished the job, so treat it as a no-op instead of surfacing an error.
    if (!error.message.includes('already belong to a club')) throw error
  }
}
