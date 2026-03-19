import { Skeleton } from '@/components/ui/skeleton'
import { useKnowledgeEntry } from '@/features/knowledge/api/knowledge.api'
import { useKnowledgeStore } from '@/features/knowledge/store/knowledge.store'

export function KnowledgeViewer() {
  const selectedEntryId = useKnowledgeStore((s) => s.selectedEntryId)
  const { data: entry, isLoading } = useKnowledgeEntry(selectedEntryId)

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    )
  }

  if (!entry) return null

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center border-b px-6 py-3">
        <h2 className="truncate text-lg font-semibold">{entry.title}</h2>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">{entry.content}</pre>
      </div>
    </div>
  )
}
