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

  if (payload.kind === 'create') {
    const { error } = await supabase.rpc('create_club', {
      p_name: payload.clubName,
      p_nickname: payload.nickname,
      p_avatar_url: payload.avatarUrl,
      p_timezone: payload.timezone,
    })
    if (error) throw error
  } else {
    const { error } = await supabase.rpc('join_club', {
      p_code: payload.code,
      p_nickname: payload.nickname,
      p_avatar_url: payload.avatarUrl,
      p_timezone: payload.timezone,
    })
    if (error) throw error
  }
}
