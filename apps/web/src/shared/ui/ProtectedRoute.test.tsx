import { useAuthStore } from '@/features/auth/store/auth.store'
import { render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from './ProtectedRoute'

vi.mock('@/features/auth/api/auth.api', () => ({
  authApi: { refresh: vi.fn() },
  useLogin: vi.fn(),
  useLogout: vi.fn(),
  useRegister: vi.fn(),
}))

// Import after mock so we get the mocked version
const { authApi } = await import('@/features/auth/api/auth.api')

function renderProtectedRoute() {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <div>Login Page</div> },
      {
        path: '/',
        element: <ProtectedRoute />,
        children: [{ index: true, element: <div>Protected Content</div> }],
      },
    ],
    { initialEntries: ['/'] }
  )
  return render(<RouterProvider router={router} />)
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, isAuthenticated: false })
    vi.clearAllMocks()
  })

  it('redirects to /login when refresh fails', async () => {
    vi.mocked(authApi.refresh).mockRejectedValue(new Error('no session'))
    renderProtectedRoute()
    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeDefined()
    })
  })

  it('renders protected content when refresh succeeds', async () => {
    vi.mocked(authApi.refresh).mockResolvedValue({
      access_token: 'tok123',
      user: { id: '1', email: 'user@example.com' },
    })
    renderProtectedRoute()
    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeDefined()
    })
  })

  it('renders protected content immediately when already authenticated', () => {
    useAuthStore.getState().setAuth('tok123', { id: '1', email: 'user@example.com' })
    renderProtectedRoute()
    expect(screen.getByText('Protected Content')).toBeDefined()
  })
})
