import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useCreateKnowledge } from '@/features/knowledge/api/knowledge.api'
import { useKnowledgeStore } from '@/features/knowledge/store/knowledge.store'
import type { KnowledgeDocType } from '@/shared/schemas/knowledge.schema'
import { FilePlus2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

const DOC_TYPE_OPTIONS: Array<{ value: KnowledgeDocType; label: string }> = [
  { value: 'general', label: 'Общее' },
  { value: 'book_excerpt', label: 'Выдержка из книги' },
  { value: 'programming_principle', label: 'Принцип программирования' },
  { value: 'exercise_note', label: 'Заметка по упражнению' },
  { value: 'coach_note', label: 'Заметка тренера' },
  { value: 'user_preference', label: 'Личное предпочтение' },
  { value: 'archive_workout', label: 'Архивная тренировка' },
]

export function KnowledgeCreateDialog() {
  const createEntry = useCreateKnowledge()
  const selectEntry = useKnowledgeStore((s) => s.selectEntry)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('')
  const [docType, setDocType] = useState<KnowledgeDocType>('book_excerpt')
  const [tags, setTags] = useState('')
  const [content, setContent] = useState('')
  const [useForGeneration, setUseForGeneration] = useState(true)

  const reset = () => {
    setTitle('')
    setSource('')
    setDocType('book_excerpt')
    setTags('')
    setContent('')
    setUseForGeneration(true)
  }

  const handleSubmit = () => {
    createEntry.mutate(
      {
        title,
        source,
        doc_type: docType,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        content,
        review_status: 'reviewed',
        use_for_generation: useForGeneration,
      },
      {
        onSuccess: (entry) => {
          selectEntry(entry.id)
          toast.success('Запись добавлена')
          setOpen(false)
          reset()
        },
        onError: () => toast.error('Не удалось добавить запись'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <FilePlus2 className="mr-2 h-4 w-4" />
          Добавить запись
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Новая запись в базу знаний</DialogTitle>
          <DialogDescription>
            Добавляй выдержки из книг, programming notes и личные правила для генерации тренировок.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="knowledge-title">Заголовок</Label>
            <Input
              id="knowledge-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Принципы прогрессии в силовом блоке"
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="knowledge-type">Тип документа</Label>
              <select
                id="knowledge-type"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={docType}
                onChange={(e) => setDocType(e.target.value as KnowledgeDocType)}
              >
                {DOC_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="knowledge-source">Источник</Label>
              <Input
                id="knowledge-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Книга, автор, статья, личная заметка"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="knowledge-tags">Теги</Label>
            <Input
              id="knowledge-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="strength, squat, progression"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="knowledge-content">Содержание</Label>
            <Textarea
              id="knowledge-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Вставь выдержку из книги или свою заметку..."
              className="min-h-56"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">Использовать при генерации</p>
              <p className="text-xs text-muted-foreground">
                Если выключено, запись останется в базе знаний, но не попадёт в RAG-контекст.
              </p>
            </div>
            <Switch checked={useForGeneration} onCheckedChange={setUseForGeneration} />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
                reset()
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createEntry.isPending || title.trim() === '' || content.trim() === ''}
            >
              {createEntry.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
