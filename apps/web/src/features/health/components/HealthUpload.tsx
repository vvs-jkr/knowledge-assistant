import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUploadHealth } from '@/features/health/api/health.api'
import { cn } from '@/lib/utils'
import { Upload } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'

export function HealthUpload() {
  const upload = useUploadHealth()
  const [labDate, setLabDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [labName, setLabName] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const isCSV = pendingFile?.name.toLowerCase().endsWith('.csv') ?? false

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) setPendingFile(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    maxFiles: 1,
    disabled: upload.isPending,
  })

  const handleSubmit = () => {
    if (!pendingFile) return
    upload.mutate(
      {
        file: pendingFile,
        ...(isCSV ? {} : { labDate }),
        ...(labName ? { labName } : {}),
      },
      {
        onSuccess: (data) => {
          toast.success(`Uploaded: ${data.metrics.length} metric(s) extracted`)
          setPendingFile(null)
          setLabName('')
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            'Upload failed'
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
        {pendingFile ? (
          <span className="font-medium text-foreground">{pendingFile.name}</span>
        ) : isDragActive ? (
          <span>Drop file here</span>
        ) : (
          <span>Drop PDF or InBody CSV</span>
        )}
      </div>

      {!isCSV && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="lab-date" className="text-xs">
              Lab date
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
              Lab name (optional)
            </Label>
            <Input
              id="lab-name"
              type="text"
              placeholder="e.g. City Lab"
              value={labName}
              onChange={(e) => setLabName(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </>
      )}

      {isCSV && (
        <p className="text-xs text-muted-foreground">
          Date and device are read automatically from the CSV.
        </p>
      )}

      <Button
        size="sm"
        className="w-full"
        onClick={handleSubmit}
        disabled={!pendingFile || (!isCSV && !labDate) || upload.isPending}
      >
        {upload.isPending ? 'Uploading...' : isCSV ? 'Upload CSV' : 'Upload & Extract'}
      </Button>
    </div>
  )
}
