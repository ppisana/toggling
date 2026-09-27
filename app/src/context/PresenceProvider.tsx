import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'

const PresenceContext = createContext<Set<string>>(new Set())

/** Tracks the current player as "online" on a per-club Realtime presence
 * channel and exposes the set of currently online profile ids to the app.
 * Presence is ephemeral (no DB table) -- it just reflects who has this app
 * open right now. */
export function PresenceProvider({ children }: { children: ReactNode }) {
  const { profile, club } = useAuth()
  const [online, setOnline] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!profile || !club) {
      setOnline(new Set())
      return
    }

    const channel = supabase.channel(`presence:club:${club.id}`, {
      config: { presence: { key: profile.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        setOnline(new Set(Object.keys(channel.presenceState())))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile, club])

  return <PresenceContext.Provider value={online}>{children}</PresenceContext.Provider>
}

export function useOnlineMembers() {
  return useContext(PresenceContext)
}
