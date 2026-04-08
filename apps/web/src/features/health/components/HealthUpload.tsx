import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUploadHealth } from '@/features/health/api/health.api'
import { useHealthStore } from '@/features/health/store/health.store'
import { cn } from '@/lib/utils'
import { Upload } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'

export function HealthUpload() {
  const upload = useUploadHealth()
  const activeSection = useHealthStore((s) => s.activeSection)
  const selectRecord = useHealthStore((s) => s.selectRecord)
  const selectLabBatch = useHealthStore((s) => s.selectLabBatch)
  const [labDate, setLabDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [labName, setLabName] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  const isInBody = activeSection === 'inbody'
  const accept = useMemo(
    () =>
      isInBody
        ? {
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.csv'],
          }
        : {
            'application/pdf': ['.pdf'],
          },
    [isInBody]
  )

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setPendingFiles(acceptedFiles)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: isInBody ? 1 : 7,
    multiple: !isInBody,
    disabled: upload.isPending,
  })

  const handleSubmit = () => {
    if (pendingFiles.length === 0) return
    upload.mutate(
      {
        files: pendingFiles,
        ...(isInBody ? {} : { labDate }),
        ...(labName ? { labName } : {}),
      },
      {
        onSuccess: (data) => {
          if (isInBody) {
            const recordId = data.records[0]?.id ?? data.record?.id ?? null
            selectRecord(recordId)
          } else {
            selectLabBatch(data.upload_batch_id ?? null)
          }

          if (data.metrics.length > 0) {
            toast.success(`Загружено файлов: ${data.records.length}, извлечено показателей: ${data.metrics.length}`)
          } else {
            toast('Файлы загружены, но показатели не распознаны. Открой сдачу и проверь исходные PDF.')
          }

          setPendingFiles([])
          setLabName('')
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            'Не удалось загрузить файл'
          toast.error(msg)
        },
      }
    )
  }

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-sm transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-muted-foreground/25 text-muted-foreground hover:border-primary/50 hover:text-foreground',
          upload.isPending && 'cursor-not-allowed opacity-60'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-5 w-5" />
        {pendingFiles.length > 0 ? (
          <span className="text-center font-medium text-foreground">
            {pendingFiles.length === 1
              ? pendingFiles[0].name
              : `Выбрано файлов: ${pendingFiles.length}`}
          </span>
        ) : isDragActive ? (
          <span>Отпустите файл здесь</span>
        ) : (
          <span>
            {isInBody
              ? 'Перетащите CSV из InBody'
              : 'Перетащите PDF анализов, от 1 до 7 файлов за одну сдачу'}
          </span>
        )}
      </div>

      {!isInBody && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="lab-date" className="text-xs">
              Дата сдачи
            </Label>
            <Input
              id="lab-date"
              type="date"
              value={labDate}
              onChange={(e) => setLabDate(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lab-name" className="text-xs">
              Лаборатория
            </Label>
            <Input
              id="lab-name"
              type="text"
              placeholder="например, Invitro"
              value={labName}
              onChange={(e) => setLabName(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </>
      )}

      {isInBody ? (
        <p className="text-xs text-muted-foreground">
          CSV из InBody хранится отдельно от анализов и не смешивается с ними в истории.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Все выбранные PDF будут сохранены как одна сдача анализов с общей датой и batch id.
        </p>
      )}

      <Button
        size="sm"
        className="w-full"
        onClick={handleSubmit}
        disabled={pendingFiles.length === 0 || (!isInBody && !labDate) || upload.isPending}
      >
        {upload.isPending
          ? 'Загрузка...'
          : isInBody
            ? 'Загрузить InBody CSV'
            : `Загрузить анализы${pendingFiles.length > 1 ? ` (${pendingFiles.length})` : ''}`}
      </Button>
    </div>
  )
}
