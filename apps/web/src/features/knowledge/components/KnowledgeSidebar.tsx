import { Separator } from '@/components/ui/separator'
import { KnowledgeCreateDialog } from '@/features/knowledge/components/KnowledgeCreateDialog'
import { KnowledgeList } from '@/features/knowledge/components/KnowledgeList'
import { KnowledgeUpload } from '@/features/knowledge/components/KnowledgeUpload'

export function KnowledgeSidebar() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-2 p-3">
        <KnowledgeCreateDialog />
        <KnowledgeUpload />
      </div>
      <Separator />
      <KnowledgeList />
    </div>
  )
}
