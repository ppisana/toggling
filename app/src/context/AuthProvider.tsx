import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Club, Profile } from '../lib/types'
import { errorMessage } from '../lib/errors'

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
      await loadProfileAndClub(activeSession.user.id)
    },
    [loadProfileAndClub],
  )

  // Supabase fires an 'INITIAL_SESSION' event on the onAuthStateChange
  // listener in addition to resolving our own getSession() call. Chaining
  // each run onto the previous one (instead of letting them fire in
  // parallel) keeps profile/club state from two overlapping loads
  // clobbering each other out of order.
  const queueRef = useRef(Promise.resolve())

  useEffect(() => {
    let active = true

    function runHandleSession(newSession: Session | null) {
      queueRef.current = queueRef.current.then(async () => {
        setLoading(true)
        setError(null)
        try {
          if (active) await handleSession(newSession)
        } catch (err) {
          if (active) setError(errorMessage(err, "We couldn't sign you in"))
        } finally {
          if (active) setLoading(false)
        }
      })
    }

    supabase.auth.getSession().then(({ data }) => runHandleSession(data.session))

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      runHandleSession(newSession)
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
