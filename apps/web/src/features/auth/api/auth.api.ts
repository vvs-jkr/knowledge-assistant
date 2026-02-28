import { type AuthUser, useAuthStore } from '@/features/auth/store/auth.store'
import { api } from '@/shared/lib/api'
import type { LoginInput, RegisterInput } from '@/shared/schemas/auth.schema'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface AuthResponse {
  access_token: string
  user: AuthUser
}

const authApi = {
  login: (data: LoginInput) => api.post<AuthResponse>('/auth/login', data).then((r) => r.data),

  register: (data: RegisterInput) =>
    api.post<AuthResponse>('/auth/register', data).then((r) => r.data),

  logout: () => api.post('/auth/logout'),

  refresh: () => api.post<AuthResponse>('/auth/refresh').then((r) => r.data),

  me: () => api.get<AuthUser>('/auth/me').then((r) => r.data),
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth)
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => setAuth(data.access_token, data.user),
  })
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth)
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => setAuth(data.access_token, data.user),
  })
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearAuth()
      queryClient.clear()
    },
  })
}

export { authApi }
