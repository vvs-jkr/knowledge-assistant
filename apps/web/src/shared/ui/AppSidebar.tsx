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
  Sparkles,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  countKey?: 'notes' | 'workouts' | 'knowledge' | 'health'
}

const NAV_LINKS: NavItem[] = [
  { to: '/chat', label: 'AI-тренер', icon: MessageCircle },
  { to: '/notes', label: 'Заметки', icon: FileText, countKey: 'notes' },
  { to: '/health', label: 'Здоровье', icon: Heart, countKey: 'health' },
  { to: '/workouts', label: 'Тренировки', icon: Activity, countKey: 'workouts' },
  { to: '/knowledge', label: 'База знаний', icon: BookOpen, countKey: 'knowledge' },
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
        'relative flex h-full shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#15352d] text-[#f7f3e8] shadow-[10px_0_40px_-28px_rgba(5,24,19,0.9)] transition-[width] duration-300 ease-out',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div
        className={cn(
          'flex h-20 shrink-0 items-center px-3',
          collapsed ? 'justify-center' : 'gap-3 px-4'
        )}
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#d9f46b] text-[#15352d] shadow-[0_8px_24px_-10px_rgba(217,244,107,0.8)]">
          <Sparkles className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-[15px] font-semibold tracking-tight">
              Knowledge Assistant
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#a9c0b7]">
              Личная система
            </p>
          </div>
        )}
      </div>

      {!collapsed && (
        <p className="px-5 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#829f94]">
          Пространство
        </p>
      )}

      <nav className="flex flex-col gap-1.5 px-2.5 py-2">
        {NAV_LINKS.map(({ to, label, icon: Icon, countKey }) => {
          const count = countKey ? counts[countKey] : 0

          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-[#d9f46b] text-[#15352d] shadow-[0_10px_28px_-18px_rgba(217,244,107,0.9)]'
                    : 'text-[#b9ccc5] hover:bg-white/[0.08] hover:text-white',
                  collapsed && 'justify-center px-0'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{label}</span>
                  {count > 0 && (
                    <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] tabular-nums opacity-75">
                      {count > 999 ? '999+' : count}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="mt-auto p-2.5">
        <Button
          variant="ghost"
          onClick={onToggle}
          className={cn(
            'h-10 w-full rounded-xl text-[#93aca2] hover:bg-white/[0.08] hover:text-white',
            collapsed ? 'px-0' : 'justify-start px-3'
          )}
          aria-label={collapsed ? 'Развернуть боковую панель' : 'Свернуть боковую панель'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="ml-2 text-xs">Свернуть меню</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  )
}
