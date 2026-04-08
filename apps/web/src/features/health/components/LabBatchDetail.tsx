import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { healthApi } from '@/features/health/api/health.api'
import { useConsultLabBatch, useHealthLabBatch } from '@/features/health/api/health.api'
import { useHealthStore } from '@/features/health/store/health.store'
import { downloadBlob } from '@/shared/lib/download'
import { ExternalLink, FileDown, Stethoscope } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

function formatReference(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${min} - ${max}`
  if (min !== null) return `> ${min}`
  if (max !== null) return `< ${max}`
  return '--'
}

export function LabBatchDetail() {
  const selectedLabBatchId = useHealthStore((s) => s.selectedLabBatchId)
  const { data: batch, isLoading } = useHealthLabBatch(selectedLabBatchId)
  const consultMutation = useConsultLabBatch(selectedLabBatchId)
  const [consultOpen, setConsultOpen] = useState(false)
  const [question, setQuestion] = useState('')

  if (selectedLabBatchId === null) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Выбери сдачу анализов слева, чтобы посмотреть все файлы и объединённые показатели.
      </div>
    )
  }

  if (isLoading || !batch) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const openFile = async (recordId: string) => {
    try {
      const blob = await healthApi.recordFile(recordId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      toast.error('Не удалось открыть файл')
    }
  }

  const downloadFile = async (recordId: string, filename: string) => {
    try {
      const blob = await healthApi.recordFile(recordId)
      downloadBlob(blob, filename)
    } catch {
      toast.error('Не удалось скачать файл')
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">{batch.lab_name || 'Сдача анализов'}</h2>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{batch.lab_date}</span>
              <span>Файлов: {batch.file_count}</span>
              <span>Показателей: {batch.metrics_count}</span>
            </div>
          </div>

          <Dialog open={consultOpen} onOpenChange={setConsultOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Stethoscope className="mr-2 h-4 w-4" />
                Консультация по анализам
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Консультация по этой сдаче</DialogTitle>
                <DialogDescription>
                  Вопрос пойдёт только по выбранной сдаче анализов, без смешивания с InBody.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Например: что здесь выбивается, на что обратить внимание, что уточнить у врача?"
                  className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />

                <div className="flex justify-end">
                  <Button
                    disabled={!question.trim() || consultMutation.isPending}
                    onClick={() => consultMutation.mutate(question.trim())}
                  >
                    {consultMutation.isPending ? 'Думаю...' : 'Получить консультацию'}
                  </Button>
                </div>

                {consultMutation.isError && (
                  <p className="text-sm text-destructive">
                    Не удалось получить консультацию по анализам.
                  </p>
                )}

                {consultMutation.data && (
                  <div className="rounded-lg border p-4 text-sm whitespace-pre-wrap">
                    {consultMutation.data.answer}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="min-h-0 overflow-auto rounded-lg border">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Файлы сдачи</h3>
          </div>
          <div className="divide-y">
            {batch.records.map((record) => (
              <div key={record.id} className="space-y-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{record.filename}</p>
                  <p className="text-xs text-muted-foreground">{record.metrics_count} метрик</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => downloadFile(record.id, record.filename)}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Скачать
                  </Button>
                  <Button size="sm" onClick={() => openFile(record.id)}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Открыть
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-h-0 overflow-auto rounded-lg border">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Сводка по анализам</h3>
          </div>
          {batch.metrics.length === 0 ? (
            <div className="space-y-2 p-4 text-sm text-muted-foreground">
              <p>Из файлов этой сдачи пока ничего не распознано.</p>
              <p>Сами PDF сохранены и доступны для открытия по кнопкам слева.</p>
            </div>
          ) : (
            <div className="divide-y">
              {batch.metrics.map((metric) => (
                <div key={metric.id} className="space-y-1 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{metric.metric_name}</span>
                    <span>
                      {metric.value} {metric.unit}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>Референс: {formatReference(metric.reference_min, metric.reference_max)}</span>
                    <span>Статус: {metric.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
