import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useHealthLabBatches } from '@/features/health/api/health.api'
import { useHealthStore } from '@/features/health/store/health.store'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'

export function LabBatchList() {
  const { data: batches, isLoading } = useHealthLabBatches()
  const selectedLabBatchId = useHealthStore((s) => s.selectedLabBatchId)
  const selectLabBatch = useHealthStore((s) => s.selectLabBatch)

  useEffect(() => {
    if (!selectedLabBatchId && batches && batches.length > 0) {
      selectLabBatch(batches[0].id)
    }
  }, [batches, selectLabBatch, selectedLabBatchId])

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (!batches?.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 p-8 text-center text-sm text-muted-foreground">
        <p>Сдач анализов пока нет</p>
        <p>Загрузи один или несколько PDF выше</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-1 p-2">
        {batches.map((batch) => (
          <button
            key={batch.id}
            type="button"
            className={cn(
              'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
              selectedLabBatchId === batch.id
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            )}
            onClick={() => selectLabBatch(batch.id)}
          >
            <p className="font-medium">{batch.lab_date}</p>
            <p className="truncate text-xs text-muted-foreground">
              {batch.lab_name || 'Анализы'} · файлов: {batch.file_count} · метрик: {batch.metrics_count}
            </p>
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}
