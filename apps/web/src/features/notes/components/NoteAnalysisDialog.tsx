import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAnalyzeNote,
  useImproveNote,
  useNote,
  useUpdateNote,
} from '@/features/notes/api/notes.api'
import { useNotesStore } from '@/features/notes/store/notes.store'
import type { NoteAnalysis } from '@/shared/schemas/notes.schema'
import axios from 'axios'
import { BrainCircuit } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface NoteAnalysisDialogProps {
  noteId: string
}

function applyTagsToContent(content: string, tags: string[]): string {
  const tagLine = `tags: [${tags.join(', ')}]`
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/)
  if (fmMatch) {
    const fm = fmMatch[1]
    const rest = content.slice(fmMatch[0].length)
    const fmWithoutTags = fm.replace(/^tags:.*$/m, '').replace(/\n+$/, '')
    return `---\n${fmWithoutTags}\n${tagLine}\n---\n${rest}`
  }
  return `---\n${tagLine}\n---\n\n${content}`
}

export function NoteAnalysisDialog({ noteId }: NoteAnalysisDialogProps) {
  const [open, setOpen] = useState(false)
  const analyzeMutation = useAnalyzeNote()
  const improveMutation = useImproveNote()
  const updateNote = useUpdateNote()
  const noteQuery = useNote(open ? noteId : null)
  const selectNote = useNotesStore((s) => s.selectNote)

  const handleOpen = (value: boolean) => {
    setOpen(value)
    if (value && !analyzeMutation.data) {
      analyzeMutation.mutate(noteId)
    }
    if (!value) {
      analyzeMutation.reset()
    }
  }

  const handleApplyTags = (tags: string[]) => {
    const content = noteQuery.data?.content
    if (!content) return
    const updated = applyTagsToContent(content, tags)
    updateNote.mutate(
      { id: noteId, body: { content: updated } },
      { onSuccess: () => toast.success('Теги применены') }
    )
  }

  const handleImprove = () => {
    improveMutation.mutate(noteId, {
      onSuccess: () => {
        toast.success('Заметка улучшена')
        setOpen(false)
      },
      onError: () => toast.error('Не удалось улучшить заметку'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Анализ AI">
          <BrainCircuit className="h-4 w-4" />
          <span className="sr-only">Анализ</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>AI Анализ</DialogTitle>
          <DialogDescription>Качество заметки, советы и проверка дублей.</DialogDescription>
        </DialogHeader>

        {analyzeMutation.isPending && <AnalysisSkeleton />}

        {analyzeMutation.isError && (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-sm text-destructive">
              {axios.isAxiosError(analyzeMutation.error)
                ? ((analyzeMutation.error.response?.data as { error?: string })?.error ??
                  `HTTP ${analyzeMutation.error.response?.status ?? 'error'}`)
                : 'Анализ не удался'}
            </p>
            <Button variant="outline" size="sm" onClick={() => analyzeMutation.mutate(noteId)}>
              Повторить
            </Button>
          </div>
        )}

        {analyzeMutation.isSuccess && (
          <>
            <ScrollArea className="max-h-[55vh]">
              <AnalysisResult
                analysis={analyzeMutation.data.analysis}
                onSelectNote={(id) => {
                  selectNote(id)
                  setOpen(false)
                }}
                onApplyTags={handleApplyTags}
                applyingTags={updateNote.isPending}
              />
            </ScrollArea>
            <Separator />
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleImprove}
                disabled={improveMutation.isPending}
              >
                {improveMutation.isPending ? 'Улучшаю...' : '✦ Улучшить заметку'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AnalysisSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

interface AnalysisResultProps {
  analysis: NoteAnalysis
  onSelectNote: (id: string) => void
  onApplyTags: (tags: string[]) => void
  applyingTags: boolean
}

function AnalysisResult({
  analysis,
  onSelectNote,
  onApplyTags,
  applyingTags,
}: AnalysisResultProps) {
  const scoreColor =
    analysis.quality_score >= 8
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : analysis.quality_score >= 5
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'

  return (
    <div className="flex flex-col gap-4 py-2 pr-4">
      {/* Краткое содержание */}
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <h4 className="text-sm font-semibold">Краткое содержание</h4>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${scoreColor}`}>
            {analysis.quality_score}/10
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{analysis.summary}</p>
      </div>

      {/* Предложенные теги */}
      {analysis.tags_suggested.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Предложенные теги</h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onApplyTags(analysis.tags_suggested)}
              disabled={applyingTags}
            >
              {applyingTags ? 'Сохраняю...' : 'Применить'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {analysis.tags_suggested.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Советы по улучшению */}
      {analysis.improvement_suggestions.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="mb-2 text-sm font-semibold">Советы по улучшению</h4>
            <ul className="flex flex-col gap-1.5">
              {analysis.improvement_suggestions.map((s, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static ordered list
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-0.5 shrink-0 font-medium text-foreground">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Возможные дубли */}
      {analysis.duplicate_candidates.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="mb-2 text-sm font-semibold">Возможные дубли</h4>
            <ul className="flex flex-col gap-2">
              {analysis.duplicate_candidates.map((d) => (
                <li key={d.note_id} className="rounded-md border p-2">
                  <button
                    type="button"
                    onClick={() => onSelectNote(d.note_id)}
                    className="mb-0.5 block text-sm font-medium hover:underline"
                  >
                    {d.filename}
                  </button>
                  <p className="text-xs text-muted-foreground">{d.similarity_reason}</p>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
