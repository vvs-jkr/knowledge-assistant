import { Separator } from '@/components/ui/separator'
import { KnowledgeList } from '@/features/knowledge/components/KnowledgeList'
import { KnowledgeUpload } from '@/features/knowledge/components/KnowledgeUpload'

export function KnowledgeSidebar() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-3">
        <KnowledgeUpload />
      </div>
      <Separator />
      <KnowledgeList />
    </div>
  )
}
