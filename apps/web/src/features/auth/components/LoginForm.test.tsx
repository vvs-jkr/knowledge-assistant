import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginForm } from './LoginForm'

vi.mock('@/features/auth/api/auth.api', () => ({
  authApi: { refresh: vi.fn() },
  useLogin: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useLogout: vi.fn(),
  useRegister: vi.fn(),
}))

function renderLoginForm() {
  return render(
    <MemoryRouter>
      <LoginForm />
    </MemoryRouter>
  )
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders email input, password input and submit button', () => {
    renderLoginForm()
    expect(screen.getByLabelText('Email')).toBeDefined()
    expect(screen.getByLabelText('Password')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeDefined()
  })

  it('shows a link to the register page', () => {
    renderLoginForm()
    expect(screen.getByRole('link', { name: 'Register' })).toBeDefined()
  })

  it('shows validation error when email is blurred without input', async () => {
    const user = userEvent.setup()
    renderLoginForm()
    const emailInput = screen.getByLabelText('Email')
    await user.click(emailInput)
    await user.tab()
    await waitFor(() => {
      expect(screen.getByText('Invalid email')).toBeDefined()
    })
  })

  it('shows validation error when password is too short', async () => {
    const user = userEvent.setup()
    renderLoginForm()
    const passwordInput = screen.getByLabelText('Password')
    await user.click(passwordInput)
    await user.type(passwordInput, 'short')
    await user.tab()
    await waitFor(() => {
      expect(screen.getByText('Min 8 characters')).toBeDefined()
    })
  })
})
