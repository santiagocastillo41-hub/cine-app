import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth-context'
import AppLayout from './components/AppLayout'
import LoginPage from './pages/LoginPage'
import WatchlistPage from './pages/WatchlistPage'
import MovieDetailPage from './pages/MovieDetailPage'
import MarkWatchedPage from './pages/MarkWatchedPage'
import ThreadPage from './pages/ThreadPage'
import PlaceholderPage from './pages/PlaceholderPage'

function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <AppLayout>
                  <WatchlistPage />
                </AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/pelicula/:id"
            element={
              <RequireAuth>
                <MovieDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/pelicula/:id/vista"
            element={
              <RequireAuth>
                <MarkWatchedPage />
              </RequireAuth>
            }
          />
          <Route
            path="/hilo/:id"
            element={
              <RequireAuth>
                <ThreadPage />
              </RequireAuth>
            }
          />
          <Route
            path="/foros"
            element={
              <RequireAuth>
                <AppLayout>
                  <PlaceholderPage title="Foros" />
                </AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/buscar"
            element={
              <RequireAuth>
                <AppLayout>
                  <PlaceholderPage title="Buscar" />
                </AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/perfil"
            element={
              <RequireAuth>
                <AppLayout>
                  <PlaceholderPage title="Perfil" />
                </AppLayout>
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
