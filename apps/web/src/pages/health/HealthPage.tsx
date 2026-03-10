import { HealthMainPanel } from '@/features/health/components/HealthMainPanel'
import { HealthSidebar } from '@/features/health/components/HealthSidebar'
import { AppHeader } from '@/shared/ui/AppHeader'

export function HealthPage() {
  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
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
