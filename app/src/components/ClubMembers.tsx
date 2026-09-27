import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { useOnlineMembers } from '../context/PresenceProvider'

export function ClubMembers() {
  const [members, setMembers] = useState<Profile[]>([])
  const online = useOnlineMembers()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase.from('profiles').select('*').order('nickname', { ascending: true })
      if (!cancelled) setMembers((data as Profile[]) ?? [])
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <aside className="rounded-2xl border border-amber-500/20 bg-emerald-950/90 p-4 backdrop-blur-sm">
      <h2 className="font-display mb-3 text-lg font-bold text-amber-50">Members</h2>
      <ul className="flex flex-col gap-2">
        {members.map((m) => {
          const isOnline = online.has(m.id)
          return (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${isOnline ? 'bg-lime-400' : 'bg-slate-600'}`}
                title={isOnline ? 'Online' : 'Offline'}
              />
              <span className="text-base leading-none">{m.avatar_url}</span>
              <span className="truncate text-amber-50">{m.nickname}</span>
              {m.is_admin && (
                <span className="ml-auto shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                  Admin
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
