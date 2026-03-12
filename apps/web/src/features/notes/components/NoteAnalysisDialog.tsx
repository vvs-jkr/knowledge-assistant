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
import { useAnalyzeNote } from '@/features/notes/api/notes.api'
import { useNotesStore } from '@/features/notes/store/notes.store'
import type { NoteAnalysis } from '@/shared/schemas/notes.schema'
import axios from 'axios'
import { BrainCircuit } from 'lucide-react'
import { useState } from 'react'

interface NoteAnalysisDialogProps {
  noteId: string
}

export function NoteAnalysisDialog({ noteId }: NoteAnalysisDialogProps) {
  const [open, setOpen] = useState(false)
  const analyzeMutation = useAnalyzeNote()
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

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Analyze with AI">
          <BrainCircuit className="h-4 w-4" />
          <span className="sr-only">Analyze</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>AI Analysis</DialogTitle>
          <DialogDescription>Note quality, suggestions, and duplicate check.</DialogDescription>
        </DialogHeader>

        {analyzeMutation.isPending && <AnalysisSkeleton />}

        {analyzeMutation.isError && (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-sm text-destructive">
              {axios.isAxiosError(analyzeMutation.error)
                ? ((analyzeMutation.error.response?.data as { error?: string })?.error ??
                  `HTTP ${analyzeMutation.error.response?.status ?? 'error'}`)
                : 'Analysis failed'}
            </p>
            <Button variant="outline" size="sm" onClick={() => analyzeMutation.mutate(noteId)}>
              Retry
            </Button>
          </div>
        )}

        {analyzeMutation.isSuccess && (
          <ScrollArea className="max-h-[60vh]">
            <AnalysisResult
              analysis={analyzeMutation.data.analysis}
              onSelectNote={(id) => {
                selectNote(id)
                setOpen(false)
              }}
            />
          </ScrollArea>
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
}

function AnalysisResult({ analysis, onSelectNote }: AnalysisResultProps) {
  const scoreColor =
    analysis.quality_score >= 8
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : analysis.quality_score >= 5
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'

  return (
    <div className="flex flex-col gap-4 py-2 pr-4">
      {/* Summary */}
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <h4 className="text-sm font-semibold">Summary</h4>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${scoreColor}`}>
            {analysis.quality_score}/10
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{analysis.summary}</p>
      </div>

      {/* Suggested tags */}
      {analysis.tags_suggested.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-sm font-semibold">Suggested tags</h4>
          <div className="flex flex-wrap gap-1">
            {analysis.tags_suggested.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Improvement suggestions */}
      {analysis.improvement_suggestions.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="mb-2 text-sm font-semibold">Improvement suggestions</h4>
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

      {/* Duplicate candidates */}
      {analysis.duplicate_candidates.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="mb-2 text-sm font-semibold">Possible duplicates</h4>
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
