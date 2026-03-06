import { Button } from '@/components/ui/button'
import { useLogout } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { HealthMainPanel } from '@/features/health/components/HealthMainPanel'
import { HealthSidebar } from '@/features/health/components/HealthSidebar'
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
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between border-b px-6 py-3">
        <span className="font-semibold">Knowledge Assistant</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={handleLogout} disabled={logout.isPending}>
            Log out
          </Button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-r">
          <HealthSidebar />
        </aside>
        <main className="flex flex-1 overflow-hidden">
          <HealthMainPanel />
        </main>
      </div>
    </div>
  )
}
