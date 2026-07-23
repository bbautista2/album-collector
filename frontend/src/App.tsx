import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useAuthStore } from './stores/authStore'

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const SignupPage = lazy(() => import('./pages/SignupPage').then((module) => ({ default: module.SignupPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const AlbumPage = lazy(() => import('./pages/AlbumPage').then((module) => ({ default: module.AlbumPage })))
const GroupsPage = lazy(() => import('./pages/GroupsPage').then((module) => ({ default: module.GroupsPage })))
const CreateAlbumPage = lazy(() =>
  import('./pages/CreateAlbumPage').then((module) => ({ default: module.CreateAlbumPage }))
)
const PublicProfilePage = lazy(() =>
  import('./pages/PublicProfilePage').then((module) => ({ default: module.PublicProfilePage }))
)
const ResetPasswordRequestPage = lazy(() =>
  import('./pages/ResetPasswordRequestPage').then((module) => ({ default: module.ResetPasswordRequestPage }))
)
const ChangePasswordPage = lazy(() =>
  import('./pages/ChangePasswordPage').then((module) => ({ default: module.ChangePasswordPage }))
)
const ResetPasswordConfirmPage = lazy(() =>
  import('./pages/ResetPasswordConfirmPage').then((module) => ({ default: module.ResetPasswordConfirmPage }))
)
const ExchangeInboxPage = lazy(() =>
  import('./pages/ExchangeInboxPage').then((module) => ({ default: module.ExchangeInboxPage }))
)

function PageFallback() {
  return (
    <Layout>
      <div className="text-center py-12">
        <p className="text-gray-500">Cargando...</p>
      </div>
    </Layout>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando...</p>
        </div>
      </Layout>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Layout>{children}</Layout>
}

function App() {
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Layout><HomePage /></Layout>} />
          <Route path="/login" element={<Layout><LoginPage /></Layout>} />
          <Route path="/signup" element={<Layout><SignupPage /></Layout>} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile/:profileId"
            element={
              <ProtectedRoute>
                <PublicProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/album/:albumId"
            element={
              <ProtectedRoute>
                <AlbumPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/albums/new"
            element={
              <ProtectedRoute>
                <CreateAlbumPage />
              </ProtectedRoute>
            }
          />

          <Route path="/reset-password" element={<Layout><ResetPasswordRequestPage /></Layout>} />
          <Route path="/reset-password/confirm" element={<Layout><ResetPasswordConfirmPage /></Layout>} />

          <Route
            path="/buzon"
            element={
              <ProtectedRoute>
                <ExchangeInboxPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/grupos"
            element={
              <ProtectedRoute>
                <GroupsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePasswordPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App

