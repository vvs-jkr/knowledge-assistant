import { AppHeader } from '@/shared/ui/AppHeader'
import { AppSidebar } from '@/shared/ui/AppSidebar'
import { useSessionManager } from '@/shared/ui/useSessionManager'
import { useState } from 'react'
import { Outlet } from 'react-router-dom'

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  } catch {
    return false
  }
}

export function AppLayout() {
  useSessionManager()
  const [collapsed, setCollapsed] = useState(getInitialCollapsed)

  const handleToggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('sidebar-collapsed', String(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar collapsed={collapsed} onToggle={handleToggle} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex flex-1 overflow-hidden">
          <Outlet />
        </main>
        <footer className="shrink-0 border-t px-6 py-2 text-xs text-muted-foreground">
          Knowledge Hub © 2026
        </footer>
      </div>
    </div>
  )
}
