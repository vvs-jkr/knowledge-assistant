import { authApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

export function ProtectedRoute() {
  const { isAuthenticated, setAuth } = useAuthStore()
  const [checking, setChecking] = useState(!isAuthenticated)

  useEffect(() => {
    if (isAuthenticated) return

    authApi
      .refresh()
      .then((data) => setAuth(data.access_token, data.user))
      .catch(() => {
        /* нет валидной сессии — редирект ниже */
      })
      .finally(() => setChecking(false))
  }, [isAuthenticated, setAuth])

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}
