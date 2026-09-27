import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Club, Profile } from '../lib/types'
import { errorMessage } from '../lib/errors'
import { consumePendingSignup } from '../lib/pendingSignup'

interface AuthState {
  loading: boolean
  error: string | null
  session: Session | null
  profile: Profile | null
  club: Club | null
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [club, setClub] = useState<Club | null>(null)

  const loadProfileAndClub = useCallback(async (userId: string) => {
    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) throw profileError
    setProfile(profileRow as Profile | null)

    if (profileRow) {
      const { data: clubRow, error: clubError } = await supabase
        .from('clubs')
        .select('*')
        .eq('id', (profileRow as Profile).club_id)
        .maybeSingle()
      if (clubError) throw clubError
      setClub(clubRow as Club | null)
    } else {
      setClub(null)
    }

    return profileRow as Profile | null
  }, [])

  const handleSession = useCallback(
    async (activeSession: Session | null) => {
      setSession(activeSession)
      if (!activeSession) {
        setProfile(null)
        setClub(null)
        return
      }

      const profileRow = await loadProfileAndClub(activeSession.user.id)
      if (!profileRow) {
        // Freshly verified a magic link (or first anonymous session) with no
        // profile yet -- finish the club they were creating/joining, if any.
        await consumePendingSignup()
        await loadProfileAndClub(activeSession.user.id)
      }
    },
    [loadProfileAndClub],
  )

  useEffect(() => {
    let active = true

    async function bootstrap() {
      setLoading(true)
      setError(null)
      try {
        const { data } = await supabase.auth.getSession()
        if (active) await handleSession(data.session)
      } catch (err) {
        if (active) setError(errorMessage(err, "We couldn't sign you in"))
      } finally {
        if (active) setLoading(false)
      }
    }

    bootstrap()

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      handleSession(newSession).catch((err) => setError(errorMessage(err, "We couldn't sign you in")))
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [handleSession])

  const refresh = useCallback(async () => {
    if (session) await loadProfileAndClub(session.user.id)
  }, [session, loadProfileAndClub])

  return (
    <AuthContext.Provider value={{ loading, error, session, profile, club, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
