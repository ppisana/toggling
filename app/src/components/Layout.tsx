import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider'

export function Layout({ children }: { children: React.ReactNode }) {
  const { profile, club } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="border-b border-amber-500/15 bg-emerald-950/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/club" className="font-display flex items-center gap-2 text-lg font-bold tracking-tight text-amber-50">
            <span className="text-xl">⛳</span>
            <span>{club?.name ?? 'Country Club'}</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {profile?.is_admin && (
              <Link
                to="/club/admin"
                className="rounded-lg border border-amber-400/30 px-3 py-1.5 text-amber-100 hover:border-amber-400 hover:bg-amber-400/10"
              >
                Manage
              </Link>
            )}
            <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-emerald-900/40 px-3 py-1.5">
              <span className="text-lg leading-none">{profile?.avatar_url}</span>
              <span className="font-medium text-amber-50">{profile?.nickname}</span>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  )
}
