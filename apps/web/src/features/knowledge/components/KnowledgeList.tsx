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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function KnowledgeList() {
  const { data: entries, isLoading } = useKnowledgeList()
  const selectedEntryId = useKnowledgeStore((s) => s.selectedEntryId)
  const selectEntry = useKnowledgeStore((s) => s.selectEntry)
  const deleteEntry = useDeleteKnowledge()

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
        <p>No entries yet</p>
        <p>Upload .md or .txt files above</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-0.5 p-2">
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
              <p className="truncate text-xs text-muted-foreground">
                {formatBytes(entry.size_bytes)}
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
                    <AlertDialogTitle>Delete entry?</AlertDialogTitle>
                    <AlertDialogDescription>
                      &ldquo;{entry.title}&rdquo; will be permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        deleteEntry.mutate(entry.id, {
                          onSuccess: () => {
                            if (selectedEntryId === entry.id) selectEntry(null)
                            toast.success('Entry deleted')
                          },
                          onError: () => toast.error('Failed to delete entry'),
                        })
                      }}
                    >
                      Delete
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
