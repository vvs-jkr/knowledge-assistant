import { KnowledgeMainPanel } from '@/features/knowledge/components/KnowledgeMainPanel'
import { KnowledgeSidebar } from '@/features/knowledge/components/KnowledgeSidebar'
import { SidebarLayout } from '@/shared/ui/SidebarLayout'

export function KnowledgePage() {
  return (
    <SidebarLayout sidebar={<KnowledgeSidebar />}>
      <KnowledgeMainPanel />
    </SidebarLayout>
  )
}
