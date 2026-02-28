import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './auth.store'

const resetStore = () =>
  useAuthStore.setState({ accessToken: null, user: null, isAuthenticated: false })

describe('useAuthStore', () => {
  beforeEach(() => {
    resetStore()
  })

  it('starts in unauthenticated state', () => {
    const { accessToken, user, isAuthenticated } = useAuthStore.getState()
    expect(accessToken).toBeNull()
    expect(user).toBeNull()
    expect(isAuthenticated).toBe(false)
  })

  it('setAuth stores token and user and marks as authenticated', () => {
    useAuthStore.getState().setAuth('tok123', { id: '1', email: 'a@b.com' })
    const { accessToken, user, isAuthenticated } = useAuthStore.getState()
    expect(accessToken).toBe('tok123')
    expect(user).toEqual({ id: '1', email: 'a@b.com' })
    expect(isAuthenticated).toBe(true)
  })

  it('clearAuth resets to unauthenticated state', () => {
    useAuthStore.getState().setAuth('tok123', { id: '1', email: 'a@b.com' })
    useAuthStore.getState().clearAuth()
    const { accessToken, user, isAuthenticated } = useAuthStore.getState()
    expect(accessToken).toBeNull()
    expect(user).toBeNull()
    expect(isAuthenticated).toBe(false)
  })

  it('setAuth overwrites previous session', () => {
    useAuthStore.getState().setAuth('tok1', { id: '1', email: 'a@b.com' })
    useAuthStore.getState().setAuth('tok2', { id: '2', email: 'b@c.com' })
    const { accessToken, user } = useAuthStore.getState()
    expect(accessToken).toBe('tok2')
    expect(user?.email).toBe('b@c.com')
  })
})
