import { Button } from '@/components/ui/button'
import { useLogout } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { useNavigate } from 'react-router-dom'

export function HealthPage() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => navigate('/login') })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <span className="font-semibold">Knowledge Assistant</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={handleLogout} disabled={logout.isPending}>
            Log out
          </Button>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center text-muted-foreground">
        Health — Phase 3
      </main>
    </div>
  )
}
