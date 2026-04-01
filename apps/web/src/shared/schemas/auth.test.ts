import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema } from './auth.schema'

describe('loginSchema', () => {
  it('accepts valid email and password', () => {
    expect(
      loginSchema.safeParse({ email: 'user@example.com', password: 'Password1' }).success
    ).toBe(true)
  })

  it('rejects invalid email format', () => {
    const result = loginSchema.safeParse({ email: 'notanemail', password: 'Password1' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Некорректный email')
    }
  })

  it('rejects password shorter than 8 characters', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'pass' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Минимум 8 символов')
    }
  })

  it('rejects missing email', () => {
    expect(loginSchema.safeParse({ email: '', password: 'Password1' }).success).toBe(false)
  })
})

describe('registerSchema', () => {
  it('accepts valid email and strong password', () => {
    expect(
      registerSchema.safeParse({ email: 'user@example.com', password: 'Password1' }).success
    ).toBe(true)
  })

  it('rejects password without uppercase letter', () => {
    const result = registerSchema.safeParse({ email: 'user@example.com', password: 'password1' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('заглавная'))).toBe(true)
    }
  })

  it('rejects password without digit', () => {
    const result = registerSchema.safeParse({ email: 'user@example.com', password: 'Passwords' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('цифра'))).toBe(true)
    }
  })

  it('inherits email validation from loginSchema', () => {
    expect(registerSchema.safeParse({ email: 'bad', password: 'Password1' }).success).toBe(false)
  })

  it('rejects password shorter than 8 characters', () => {
    expect(registerSchema.safeParse({ email: 'user@example.com', password: 'P1' }).success).toBe(
      false
    )
  })
})
