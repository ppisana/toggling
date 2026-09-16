import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthProvider'
import { Landing } from './pages/Landing'
import { Dashboard } from './pages/Dashboard'
import { AdminClub } from './pages/AdminClub'
import { TournamentView } from './pages/TournamentView'
import { MatchDetail } from './pages/MatchDetail'
import { Layout } from './components/Layout'

function Gate({ children }: { children: React.ReactNode }) {
  const { loading, error, profile } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Cargando…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center text-red-500">
        {error}
      </div>
    )
  }

  if (!profile) {
    return <Landing />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { profile } = useAuth()

  return (
    <Routes>
      <Route path="/" element={profile ? <Navigate to="/club" replace /> : <Landing />} />
      <Route
        path="/club"
        element={
          <Gate>
            <Layout>
              <Dashboard />
            </Layout>
          </Gate>
        }
      />
      <Route
        path="/club/admin"
        element={
          <Gate>
            <Layout>
              <AdminClub />
            </Layout>
          </Gate>
        }
      />
      <Route
        path="/tournament/:tournamentId"
        element={
          <Gate>
            <Layout>
              <TournamentView />
            </Layout>
          </Gate>
        }
      />
      <Route
        path="/match/:matchId"
        element={
          <Gate>
            <Layout>
              <MatchDetail />
            </Layout>
          </Gate>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
