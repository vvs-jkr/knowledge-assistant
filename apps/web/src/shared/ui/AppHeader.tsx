import { Button } from '@/components/ui/button'
import { useLogout } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { useNavigate } from 'react-router-dom'

export function AppHeader() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => navigate('/login') })
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-end border-b px-6 gap-4">
      <span className="text-sm text-muted-foreground">{user?.email}</span>
      <ThemeToggle />
      <Button variant="outline" size="sm" onClick={handleLogout} disabled={logout.isPending}>
        Log out
      </Button>
    </header>
  )
}
