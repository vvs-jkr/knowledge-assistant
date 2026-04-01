import { useUploadNotes } from '@/features/notes/api/notes.api'
import { cn } from '@/lib/utils'
import { Upload } from 'lucide-react'
import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'

export function NoteUpload() {
  const upload = useUploadNotes()

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return
      upload.mutate(acceptedFiles, {
        onSuccess: (notes) => {
          toast.success(`Загружено заметок: ${notes.length}`)
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            'Не удалось загрузить файл'
          toast.error(msg)
        },
      })
    },
    [upload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/markdown': ['.md', '.markdown'] },
    disabled: upload.isPending,
  })

  return (
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
      {upload.isPending ? (
        <span>Загрузка...</span>
      ) : isDragActive ? (
        <span>Отпустите файлы здесь</span>
      ) : (
        <span>Перетащите `.md`-файлы или нажмите для выбора</span>
      )}
    </div>
  )
}
