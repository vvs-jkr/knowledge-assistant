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
import { useDeleteHealthRecord, useHealthRecords } from '@/features/health/api/health.api'
import { useHealthStore } from '@/features/health/store/health.store'
import { cn } from '@/lib/utils'
import { Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function HealthRecordList() {
  const { data: records, isLoading } = useHealthRecords('inbody')
  const selectedRecordId = useHealthStore((s) => s.selectedRecordId)
  const selectRecord = useHealthStore((s) => s.selectRecord)
  const deleteRecord = useDeleteHealthRecord()

  useEffect(() => {
    if (!selectedRecordId && records && records.length > 0) {
      selectRecord(records[0].id)
    }
  }, [records, selectRecord, selectedRecordId])

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (!records?.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 p-8 text-center text-sm text-muted-foreground">
        <p>InBody записей пока нет</p>
        <p>Загрузи CSV выше</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-0.5 p-2">
        {records.map((record) => (
          <div
            key={record.id}
            className={cn(
              'group flex items-center rounded-md text-sm',
              selectedRecordId === record.id
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <button
              type="button"
              className="min-w-0 flex-1 px-2 py-2 text-left"
              onClick={() => selectRecord(record.id)}
            >
              <p className="truncate font-medium">{record.lab_date}</p>
              <p className="truncate text-xs text-muted-foreground">
                {record.lab_name || record.filename} · {record.metrics_count} метрик ·{' '}
                {formatBytes(record.pdf_size_bytes)}
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
                    <AlertDialogTitle>Удалить InBody запись?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Это навсегда удалит запись от {record.lab_date} и все извлечённые метрики.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        deleteRecord.mutate(record.id, {
                          onSuccess: () => {
                            if (selectedRecordId === record.id) selectRecord(null)
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
