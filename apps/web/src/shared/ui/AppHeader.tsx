import { Button } from '@/components/ui/button'
import { useLogout } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { NavLink, useNavigate } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/notes', label: 'Notes' },
  { to: '/health', label: 'Health' },
  { to: '/workouts', label: 'Workouts' },
]

export function AppHeader() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => navigate('/login') })
  }

  return (
    <header className="flex shrink-0 items-center justify-between border-b px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="font-semibold">Knowledge Assistant</span>
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{user?.email}</span>
        <ThemeToggle />
        <Button variant="outline" size="sm" onClick={handleLogout} disabled={logout.isPending}>
          Log out
        </Button>
      </div>
    </header>
  )
}
