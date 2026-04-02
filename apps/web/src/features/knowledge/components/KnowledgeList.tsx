import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeleteKnowledge, useKnowledgeList } from '@/features/knowledge/api/knowledge.api'
import { useKnowledgeStore } from '@/features/knowledge/store/knowledge.store'
import { cn } from '@/lib/utils'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const DOC_TYPE_LABELS: Record<string, string> = {
  general: 'Общее',
  archive_workout: 'Архив',
  book_excerpt: 'Книга',
  programming_principle: 'Принцип',
  exercise_note: 'Упражнение',
  coach_note: 'Тренер',
  user_preference: 'Предпочтение',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function KnowledgeList() {
  const selectedEntryId = useKnowledgeStore((s) => s.selectedEntryId)
  const docTypeFilter = useKnowledgeStore((s) => s.docTypeFilter)
  const selectEntry = useKnowledgeStore((s) => s.selectEntry)
  const setDocTypeFilter = useKnowledgeStore((s) => s.setDocTypeFilter)
  const deleteEntry = useDeleteKnowledge()
  const { data: entries, isLoading } = useKnowledgeList({ doc_type: docTypeFilter })

  const filterOptions = [
    { value: 'all', label: 'Все' },
    { value: 'book_excerpt', label: 'Книги' },
    { value: 'programming_principle', label: 'Принципы' },
    { value: 'exercise_note', label: 'Упражнения' },
    { value: 'user_preference', label: 'Предпочтения' },
  ] as const

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (!entries?.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 p-8 text-center text-sm text-muted-foreground">
        <p>Записей пока нет</p>
        <p>Загрузите `.md` или `.txt` файлы через форму выше</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-2 p-2">
        <div className="flex flex-wrap gap-1 px-1">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              variant={docTypeFilter === option.value ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setDocTypeFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={cn(
              'group flex items-center rounded-md text-sm',
              selectedEntryId === entry.id
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <button
              type="button"
              className="min-w-0 flex-1 px-2 py-2 text-left"
              onClick={() => selectEntry(entry.id)}
            >
              <p className="truncate font-medium">{entry.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <Badge variant="secondary" className="text-[10px]">
                  {DOC_TYPE_LABELS[entry.doc_type] ?? entry.doc_type}
                </Badge>
                {!entry.use_for_generation ? (
                  <Badge variant="outline" className="text-[10px]">
                    Только справочно
                  </Badge>
                ) : null}
              </div>
              <p className="truncate pt-1 text-xs text-muted-foreground">
                {formatBytes(entry.size_bytes)}
                {entry.tags.length > 0 ? ` • ${entry.tags.join(', ')}` : ''}
              </p>
            </button>
            <div className="shrink-0 pr-1">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
                    <AlertDialogDescription>
                      &ldquo;{entry.title}&rdquo; будет удалена без возможности восстановления.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        deleteEntry.mutate(entry.id, {
                          onSuccess: () => {
                            if (selectedEntryId === entry.id) selectEntry(null)
                            toast.success('Запись удалена')
                          },
                          onError: () => toast.error('Не удалось удалить запись'),
                        })
                      }}
                    >
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
