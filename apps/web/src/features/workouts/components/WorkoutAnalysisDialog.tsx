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
import { useAnalyzeWorkouts } from '@/features/workouts/api/workouts.api'
import type { WorkoutAnalysis } from '@/features/workouts/api/workouts.api'
import axios from 'axios'
import { BrainCircuit } from 'lucide-react'
import { useState } from 'react'

const FOCUS_LABELS: Record<string, string> = {
  cardio: 'Кардио',
  mass: 'Набор массы',
  strength: 'Сила',
  mixed: 'Смешанный',
}

export function WorkoutAnalysisDialog() {
  const [open, setOpen] = useState(false)
  const analyzeMutation = useAnalyzeWorkouts()

  const handleOpen = (value: boolean) => {
    setOpen(value)
    if (value && !analyzeMutation.data) {
      analyzeMutation.mutate()
    }
    if (!value) {
      analyzeMutation.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BrainCircuit className="h-4 w-4" />
          Analyze
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>AI Анализ тренировок</DialogTitle>
          <DialogDescription>
            Паттерны, баланс мышечных групп и рекомендации на основе истории.
          </DialogDescription>
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
            <Button variant="outline" size="sm" onClick={() => analyzeMutation.mutate()}>
              Повторить
            </Button>
          </div>
        )}

        {analyzeMutation.isSuccess && (
          <ScrollArea className="max-h-[60vh]">
            <AnalysisResult analysis={analyzeMutation.data} />
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AnalysisSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}

function AnalysisResult({ analysis }: { analysis: WorkoutAnalysis }) {
  const focusLabel = FOCUS_LABELS[analysis.suggested_focus] ?? analysis.suggested_focus

  return (
    <div className="flex flex-col gap-4 py-2 pr-4">
      {/* Summary + focus badge */}
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <h4 className="text-sm font-semibold">Общая оценка</h4>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            Фокус: {focusLabel}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{analysis.summary}</p>
      </div>

      <Separator />

      {/* Patterns */}
      {analysis.patterns.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Паттерны тренировок</h4>
          <ul className="flex flex-col gap-1.5">
            {analysis.patterns.map((p, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static ordered list
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-0.5 shrink-0 text-foreground">-</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Separator />

      {/* Muscle balance */}
      <div>
        <h4 className="mb-1.5 text-sm font-semibold">Баланс мышечных групп</h4>
        <p className="text-sm text-muted-foreground">{analysis.muscle_balance}</p>
      </div>

      <Separator />

      {/* Strengths */}
      {analysis.strengths.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Сильные стороны</h4>
          <ul className="flex flex-col gap-1.5">
            {analysis.strengths.map((s, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static ordered list
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-0.5 shrink-0 font-medium text-green-600 dark:text-green-400">
                  ✓
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Separator />

      {/* Improvements */}
      {analysis.improvements.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Рекомендации</h4>
          <ul className="flex flex-col gap-1.5">
            {analysis.improvements.map((rec, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static ordered list
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-0.5 shrink-0 font-medium text-foreground">{i + 1}.</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
