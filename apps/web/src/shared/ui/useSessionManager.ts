import { authApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const INACTIVITY_LIMIT_MS = 60 * 60 * 1000 // 1 hour
const TOKEN_REFRESH_INTERVAL_MS = 14 * 60 * 1000 // 14 min (access token TTL is 15 min)
const ACTIVITY_THROTTLE_MS = 10_000 // update lastActivity at most every 10s

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const

/**
 * Manages session lifetime:
 * - Proactively refreshes the access token every 14 min while the user is active.
 * - Logs the user out after 1 hour of inactivity.
 */
export function useSessionManager() {
  const { setAuth, clearAuth, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const lastActivityRef = useRef(Date.now())
  const lastThrottleRef = useRef(Date.now())

  const handleLogout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore logout errors
    }
    clearAuth()
    navigate('/login', { replace: true })
  }, [clearAuth, navigate])

  const handleActivity = useCallback(() => {
    const now = Date.now()
    if (now - lastThrottleRef.current > ACTIVITY_THROTTLE_MS) {
      lastActivityRef.current = now
      lastThrottleRef.current = now
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    // Register activity listeners
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true })
    }

    // Single interval: checks inactivity + proactive token refresh
    const interval = setInterval(async () => {
      const idle = Date.now() - lastActivityRef.current

      if (idle >= INACTIVITY_LIMIT_MS) {
        await handleLogout()
        return
      }

      // Refresh token proactively if user was active in the last refresh window
      if (idle < TOKEN_REFRESH_INTERVAL_MS) {
        try {
          const data = await authApi.refresh()
          setAuth(data.access_token, data.user)
        } catch {
          // refresh failed → the axios interceptor will catch the next 401
        }
      }
    }, TOKEN_REFRESH_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity)
      }
    }
  }, [isAuthenticated, handleActivity, handleLogout, setAuth])
}
