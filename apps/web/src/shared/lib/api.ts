import { useAuthStore } from '@/features/auth/store/auth.store'
import axios from 'axios'

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean
  }
}

export const api = axios.create({
  // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
  baseURL: import.meta.env['VITE_API_URL'] ?? 'http://localhost:8080',
  withCredentials: true, // для HttpOnly cookie (refresh token)
})

// Подставляем access token в каждый запрос
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// При 401 — пробуем обновить токен (не для auth-эндпоинтов)
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const isAuthEndpoint = original.url === '/auth/login' || original.url === '/auth/register'
    if (err.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true
      try {
        const { data } = await api.post('/auth/refresh')
        useAuthStore.getState().setAuth(data.access_token, data.user)
        return api(original)
      } catch {
        useAuthStore.getState().clearAuth()
        window.location.href = '/login'
        return Promise.reject(err)
      }
    }
    return Promise.reject(err)
  }
)
