import { KnowledgeViewer } from '@/features/knowledge/components/KnowledgeViewer'
import { useKnowledgeStore } from '@/features/knowledge/store/knowledge.store'

export function KnowledgeMainPanel() {
  const selectedEntryId = useKnowledgeStore((s) => s.selectedEntryId)

  if (!selectedEntryId) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        Выберите запись, чтобы открыть содержимое
      </div>
    )
  }

  return <KnowledgeViewer key={selectedEntryId} />
}
