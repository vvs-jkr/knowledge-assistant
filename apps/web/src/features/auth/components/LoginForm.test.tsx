import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLogin } from '@/features/auth/api/auth.api'
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
    expect(screen.getByLabelText('Пароль')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Войти' })).toBeDefined()
  })

  it('shows a link to the register page', () => {
    renderLoginForm()
    expect(screen.getByRole('link', { name: 'Зарегистрироваться' })).toBeDefined()
  })

  it('shows validation error when email is blurred without input', async () => {
    const user = userEvent.setup()
    renderLoginForm()
    const emailInput = screen.getByLabelText('Email')
    await user.click(emailInput)
    await user.tab()
    await waitFor(() => {
      expect(screen.getByText('Некорректный email')).toBeDefined()
    })
  })

  it('shows validation error when password is too short', async () => {
    const user = userEvent.setup()
    renderLoginForm()
    const passwordInput = screen.getByLabelText('Пароль')
    await user.click(passwordInput)
    await user.type(passwordInput, 'short')
    await user.tab()
    await waitFor(() => {
      expect(screen.getByText('Минимум 8 символов')).toBeDefined()
    })
  })

  it('sets browser autocomplete hints for autofill', () => {
    renderLoginForm()
    expect(screen.getByLabelText('Email').getAttribute('autocomplete')).toBe('email')
    expect(screen.getByLabelText('Пароль').getAttribute('autocomplete')).toBe('current-password')
  })

  it('submits login credentials', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useLogin).mockReturnValue({ mutateAsync, isPending: false } as never)

    const user = userEvent.setup()
    renderLoginForm()

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.type(screen.getByLabelText('Пароль'), 'Password123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        { email: 'user@example.com', password: 'Password123' },
        expect.any(Object),
      )
    })
  })
})
