import { Button } from '@/components/ui/button'
import { useLogout } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { LogOut } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const PAGE_META: Record<string, { title: string; eyebrow: string }> = {
  '/chat': { title: 'AI-тренер', eyebrow: 'Диалог и рекомендации' },
  '/notes': { title: 'Заметки', eyebrow: 'Материалы и разборы' },
  '/health': { title: 'Здоровье', eyebrow: 'Динамика и лабораторные данные' },
  '/workouts': { title: 'Тренировки', eyebrow: 'Планирование и история' },
  '/knowledge': { title: 'База знаний', eyebrow: 'Проверенный контекст' },
}

export function AppHeader() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const navigate = useNavigate()
  const location = useLocation()
  const page =
    Object.entries(PAGE_META).find(([path]) => location.pathname.startsWith(path))?.[1] ??
    PAGE_META['/notes']

  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => navigate('/login') })
  }

  return (
    <header className="flex h-20 shrink-0 items-center justify-between gap-4 px-4 md:px-6">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {page.eyebrow}
        </p>
        <h1 className="truncate font-display text-xl font-semibold tracking-tight md:text-2xl">
          {page.title}
        </h1>
      </div>

      <div className="flex items-center gap-1.5 rounded-2xl border bg-card/70 p-1.5 shadow-sm backdrop-blur-md">
        <div className="hidden items-center gap-2 pl-1.5 pr-2 lg:flex">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
            {user?.email?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <span className="max-w-44 truncate text-xs text-muted-foreground">{user?.email}</span>
        </div>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          disabled={logout.isPending}
          className="h-9 rounded-xl px-2 text-muted-foreground hover:text-foreground"
          title="Выйти"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden xl:inline">Выйти</span>
        </Button>
      </div>
    </header>
  )
}
