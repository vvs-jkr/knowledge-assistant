import { Button } from '@/components/ui/button'
import { useUploadKnowledge } from '@/features/knowledge/api/knowledge.api'
import { Upload } from 'lucide-react'
import { useRef } from 'react'
import { toast } from 'sonner'

export function KnowledgeUpload() {
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadKnowledge()

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const arr = Array.from(files)
    upload.mutate(arr, {
      onSuccess: (entries) => toast.success(`Загружено файлов: ${entries.length}`),
      onError: () => toast.error('Не удалось загрузить файлы'),
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".md,.txt,.markdown"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
      >
        <Upload className="mr-2 h-4 w-4" />
        {upload.isPending ? 'Загрузка...' : 'Загрузить материалы'}
      </Button>
    </div>
  )
}
