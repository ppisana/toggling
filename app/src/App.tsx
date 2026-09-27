import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthProvider'
import { PresenceProvider } from './context/PresenceProvider'
import { Landing } from './pages/Landing'
import { Dashboard } from './pages/Dashboard'
import { AdminClub } from './pages/AdminClub'
import { TournamentView } from './pages/TournamentView'
import { MatchDetail } from './pages/MatchDetail'
import { Layout } from './components/Layout'

function AppRoutes() {
  const { loading, error, profile } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-amber-100/50">Loading…</div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center text-red-400">
        {error}
      </div>
    )
  }

  if (!profile) {
    return <Landing />
  }

  return (
    <PresenceProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/club" replace />} />
        <Route
          path="/club"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />
        <Route
          path="/club/admin"
          element={
            <Layout>
              <AdminClub />
            </Layout>
          }
        />
        <Route
          path="/tournament/:tournamentId"
          element={
            <Layout>
              <TournamentView />
            </Layout>
          }
        />
        <Route
          path="/match/:matchId"
          element={
            <Layout>
              <MatchDetail />
            </Layout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PresenceProvider>
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
