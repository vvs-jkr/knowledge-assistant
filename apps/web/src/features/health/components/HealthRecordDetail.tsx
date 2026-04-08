import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useHealthRecord,
  useHealthRecordFile,
} from '@/features/health/api/health.api'
import { useHealthStore } from '@/features/health/store/health.store'
import { downloadBlob } from '@/shared/lib/download'
import { ExternalLink, FileDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatReference(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${min} - ${max}`
  if (min !== null) return `> ${min}`
  if (max !== null) return `< ${max}`
  return '--'
}

export function HealthRecordDetail() {
  const selectedRecordId = useHealthStore((s) => s.selectedRecordId)
  const { data: record, isLoading } = useHealthRecord(selectedRecordId)
  const { data: fileBlob, isLoading: isFileLoading } = useHealthRecordFile(selectedRecordId)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const isPdf = useMemo(
    () => (record ? record.filename.toLowerCase().endsWith('.pdf') : false),
    [record]
  )

  useEffect(() => {
    if (!fileBlob || !isPdf) {
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return null
      })
      return
    }

    const nextUrl = URL.createObjectURL(fileBlob)
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return nextUrl
    })

    return () => URL.revokeObjectURL(nextUrl)
  }, [fileBlob, isPdf])

  if (selectedRecordId === null) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Выбери запись слева, чтобы посмотреть исходный файл и извлечённые показатели.
      </div>
    )
  }

  if (isLoading || !record) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b px-4 py-3">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-base font-semibold">
            {record.lab_name || record.filename}
          </h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{record.lab_date}</span>
            <span>{record.filename}</span>
            <span>{formatBytes(record.pdf_size_bytes)}</span>
            <span>{record.metrics_count} показателей</span>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!fileBlob || isFileLoading}
            onClick={() => {
              if (!fileBlob || !record) return
              downloadBlob(fileBlob, record.filename)
            }}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Скачать
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!previewUrl}
            onClick={() => {
              if (!previewUrl) return
              window.open(previewUrl, '_blank', 'noopener,noreferrer')
            }}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Открыть
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="min-h-0 overflow-hidden rounded-lg border bg-background">
          {isPdf ? (
            previewUrl ? (
              <iframe title={record.filename} src={previewUrl} className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
                Подготавливаю предпросмотр PDF...
              </div>
            )
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              Для CSV встроенный предпросмотр не нужен. Используй «Открыть» или «Скачать», а
              справа смотри извлечённые метрики.
            </div>
          )}
        </div>

        <div className="min-h-0 overflow-auto rounded-lg border">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Извлечённые показатели</h3>
          </div>

          {record.metrics.length === 0 ? (
            <div className="space-y-2 p-4 text-sm text-muted-foreground">
              <p>Из этого файла пока ничего не распознано.</p>
              <p>
                Сейчас PDF extraction заточен под ограниченный набор канонических lab metrics.
                Файл при этом сохранён и доступен для просмотра.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {record.metrics.map((metric) => (
                <div key={metric.id} className="space-y-1 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{metric.metric_name}</span>
                    <span className="shrink-0">
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
