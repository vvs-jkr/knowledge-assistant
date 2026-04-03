import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRegister } from '@/features/auth/api/auth.api'
import { registerSchema } from '@/shared/schemas/auth.schema'
import { useForm } from '@tanstack/react-form'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export function RegisterForm() {
  const navigate = useNavigate()
  const register = useRegister()

  const form = useForm({
    defaultValues: { email: '', password: '' },
  })

  async function handleSubmit(formEl: HTMLFormElement) {
    if (register.isPending) {
      return
    }

    const formData = new FormData(formEl)
    const payload = {
      email: String(formData.get('email') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
    }

    const parsed = registerSchema.safeParse(payload)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Проверь email и пароль')
      return
    }

    await register.mutateAsync(parsed.data, {
      onSuccess: () => navigate('/notes'),
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Не удалось зарегистрироваться'
        toast.error(msg)
      },
    })
  }

  return (
    <form
      onSubmit={async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        await handleSubmit(e.currentTarget)
      }}
      className="space-y-4"
    >
      <form.Field
        name="email"
        validators={{
          onBlur: ({ value }) => {
            const result = registerSchema.shape.email.safeParse(value)
            return result.success ? undefined : result.error.issues[0].message
          },
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <Label htmlFor="reg-email">Email</Label>
            <Input
              id="reg-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={register.isPending}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
            )}
          </div>
        )}
      </form.Field>

      <form.Field
        name="password"
        validators={{
          onBlur: ({ value }) => {
            const result = registerSchema.shape.password.safeParse(value)
            return result.success ? undefined : result.error.issues[0].message
          },
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <Label htmlFor="reg-password">Пароль</Label>
            <Input
              id="reg-password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={register.isPending}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Минимум 8 символов, одна заглавная буква и одна цифра
            </p>
          </div>
        )}
      </form.Field>

      <Button type="submit" className="w-full" disabled={register.isPending}>
        {register.isPending ? 'Создаю аккаунт...' : 'Создать аккаунт'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Уже есть аккаунт?{' '}
        <Link to="/login" className="underline underline-offset-4 hover:text-foreground">
          Войти
        </Link>
      </p>
    </form>
  )
}
