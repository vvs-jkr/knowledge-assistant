import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLogin } from '@/features/auth/api/auth.api'
import { loginSchema } from '@/shared/schemas/auth.schema'
import { useForm } from '@tanstack/react-form'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export function LoginForm() {
  const navigate = useNavigate()
  const login = useLogin()

  const form = useForm({
    defaultValues: { email: '', password: '' },
  })

  async function handleSubmit(formEl: HTMLFormElement) {
    if (login.isPending) {
      return
    }

    const formData = new FormData(formEl)
    const payload = {
      email: String(formData.get('email') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
    }

    const parsed = loginSchema.safeParse(payload)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Проверь email и пароль')
      return
    }

    await login.mutateAsync(parsed.data, {
      onSuccess: () => navigate('/notes'),
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Не удалось войти'
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
            const result = loginSchema.shape.email.safeParse(value)
            return result.success ? undefined : result.error.issues[0].message
          },
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={login.isPending}
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
            const result = loginSchema.shape.password.safeParse(value)
            return result.success ? undefined : result.error.issues[0].message
          },
        }}
      >
        {(field) => (
          <div className="space-y-1">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={login.isPending}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
            )}
          </div>
        )}
      </form.Field>

      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending ? 'Вход...' : 'Войти'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Нет аккаунта?{' '}
        <Link to="/register" className="underline underline-offset-4 hover:text-foreground">
          Зарегистрироваться
        </Link>
      </p>
    </form>
  )
}
