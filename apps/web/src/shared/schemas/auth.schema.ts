import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(8, 'Минимум 8 символов'),
})

export const registerSchema = loginSchema.extend({
  password: z
    .string()
    .min(8, 'Минимум 8 символов')
    .regex(/[A-Z]/, 'Хотя бы одна заглавная буква')
    .regex(/[0-9]/, 'Хотя бы одна цифра'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
