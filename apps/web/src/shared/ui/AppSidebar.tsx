import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSidebarCounts } from '@/shared/hooks/useSidebarCounts'
import {
  Activity,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Heart,
  MessageCircle,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  countKey?: 'notes' | 'workouts' | 'knowledge' | 'health'
}

const NAV_LINKS: NavItem[] = [
  { to: '/notes', label: 'Заметки', icon: FileText, countKey: 'notes' },
  { to: '/health', label: 'Здоровье', icon: Heart, countKey: 'health' },
  { to: '/workouts', label: 'Тренировки', icon: Activity, countKey: 'workouts' },
  { to: '/knowledge', label: 'База знаний', icon: BookOpen, countKey: 'knowledge' },
  { to: '/chat', label: 'Тренер', icon: MessageCircle },
]

interface AppSidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const counts = useSidebarCounts()

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r bg-card transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b px-3',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!collapsed && <span className="truncate text-sm font-semibold">Knowledge Assistant</span>}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8 shrink-0"
          aria-label={collapsed ? 'Развернуть боковую панель' : 'Свернуть боковую панель'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex flex-col gap-1 p-2">
        {NAV_LINKS.map(({ to, label, icon: Icon, countKey }) => {
          const count = countKey ? counts[countKey] : 0

          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-2 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  collapsed && 'justify-center px-0'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{label}</span>
                  {count > 0 && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {count > 999 ? '999+' : count}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
