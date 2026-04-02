import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useKnowledgeEntry } from '@/features/knowledge/api/knowledge.api'
import { useKnowledgeStore } from '@/features/knowledge/store/knowledge.store'

const DOC_TYPE_LABELS: Record<string, string> = {
  general: 'Общее',
  archive_workout: 'Архив',
  book_excerpt: 'Выдержка из книги',
  programming_principle: 'Принцип программирования',
  exercise_note: 'Заметка по упражнению',
  coach_note: 'Заметка тренера',
  user_preference: 'Личное предпочтение',
}

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
      <div className="flex shrink-0 flex-col gap-2 border-b px-6 py-3">
        <h2 className="truncate text-lg font-semibold">{entry.title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{DOC_TYPE_LABELS[entry.doc_type] ?? entry.doc_type}</Badge>
          {entry.source ? <Badge variant="outline">{entry.source}</Badge> : null}
          {!entry.use_for_generation ? (
            <Badge variant="outline">Не использовать в генерации</Badge>
          ) : null}
          {entry.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">{entry.content}</pre>
      </div>
    </div>
  )
}
