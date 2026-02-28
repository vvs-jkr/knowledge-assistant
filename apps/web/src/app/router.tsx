import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { HealthPage } from '@/pages/health/HealthPage'
import { NotesPage } from '@/pages/notes/NotesPage'
import { ProtectedRoute } from '@/shared/ui/ProtectedRoute'
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <Navigate to="/notes" replace /> },
      { path: 'notes', element: <NotesPage /> },
      { path: 'health', element: <HealthPage /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
