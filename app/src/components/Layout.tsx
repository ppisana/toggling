import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider'

export function Layout({ children }: { children: React.ReactNode }) {
  const { profile, club } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/club" className="flex items-center gap-2 font-bold">
            <span className="text-xl">⛳</span>
            <span>{club?.name ?? 'Country Club'}</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {profile?.is_admin && (
              <Link
                to="/club/admin"
                className="rounded-lg border border-slate-300 px-3 py-1.5 hover:border-emerald-500 dark:border-slate-700"
              >
                Administrar
              </Link>
            )}
            <div className="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 dark:border-slate-700">
              <span className="text-lg leading-none">{profile?.avatar_url}</span>
              <span className="font-medium">{profile?.nickname}</span>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  )
}
