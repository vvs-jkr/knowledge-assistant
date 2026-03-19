import { useUiStore } from '@/shared/store/ui.store'
import { AppHeader } from '@/shared/ui/AppHeader'
import { AppSidebar } from '@/shared/ui/AppSidebar'
import { KeyboardShortcutsHelp } from '@/shared/ui/KeyboardShortcutsHelp'
import { useGlobalShortcuts } from '@/shared/ui/useGlobalShortcuts'
import { useSessionManager } from '@/shared/ui/useSessionManager'
import { Outlet } from 'react-router-dom'

export function AppLayout() {
  useSessionManager()
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const { helpOpen, setHelpOpen } = useGlobalShortcuts()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex flex-1 overflow-hidden">
          <Outlet />
        </main>
        <footer className="shrink-0 border-t px-6 py-2 text-xs text-muted-foreground">
          Knowledge Hub © 2026
        </footer>
      </div>
      <KeyboardShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}
