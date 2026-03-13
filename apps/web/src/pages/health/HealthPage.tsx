import { HealthMainPanel } from '@/features/health/components/HealthMainPanel'
import { HealthSidebar } from '@/features/health/components/HealthSidebar'
import { SidebarLayout } from '@/shared/ui/SidebarLayout'

export function HealthPage() {
  return (
    <SidebarLayout sidebar={<HealthSidebar />}>
      <HealthMainPanel />
    </SidebarLayout>
  )
}
