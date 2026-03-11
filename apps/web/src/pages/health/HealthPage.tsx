import { HealthMainPanel } from '@/features/health/components/HealthMainPanel'
import { HealthSidebar } from '@/features/health/components/HealthSidebar'

export function HealthPage() {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-r">
        <HealthSidebar />
      </aside>
      <main className="flex flex-1 overflow-hidden">
        <HealthMainPanel />
      </main>
    </div>
  )
}
