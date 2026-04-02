import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useGenerateWorkout } from '@/features/knowledge/api/knowledge.api'
import { workoutsApi } from '@/features/workouts/api/workouts.api'
import type { WorkoutDraft } from '@/shared/schemas/knowledge.schema'
import { useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

function DraftPreview({ draft }: { draft: WorkoutDraft }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold">{draft.name}</p>
        <p className="text-sm text-muted-foreground">
          {draft.workout_type}
          {draft.duration_mins !== null ? ` · ${draft.duration_mins} min` : ''}
        </p>
      </div>

      {draft.notes && <p className="text-sm text-muted-foreground italic">{draft.notes}</p>}

      {draft.sections.length > 0 ? (
        <div className="space-y-3">
          {draft.sections.map((section) => (
            <div key={`${section.section_key}-${section.title}`} className="space-y-1">
              <p className="text-sm font-semibold">
                {section.section_key}. {section.title}
              </p>
              {section.description && (
                <p className="text-xs text-muted-foreground">{section.description}</p>
              )}
              <div className="space-y-1">
                {section.items.map((item, i) => (
                  <div
                    key={`${section.section_key}-${item.name}-${i}`}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-right text-muted-foreground">
                      {[
                        item.sets !== null ? `${item.sets} подх.` : null,
                        item.reps !== null ? `x ${item.reps} повт.` : null,
                        item.weight_note,
                        item.prescription_text,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {draft.exercises.map((ex, i) => (
            <div key={`${ex.name}-${i}`} className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{ex.name}</span>
              <span className="text-muted-foreground">
                {[
                  ex.sets !== null ? `${ex.sets} подх.` : null,
                  ex.reps !== null ? `x ${ex.reps} повт.` : null,
                  ex.weight_note,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function GenerateWorkoutDialog() {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const generate = useGenerateWorkout()
  const qc = useQueryClient()

  const handleGenerate = () => {
    if (!prompt.trim()) return
    generate.mutate(prompt.trim(), {
      onError: () => toast.error('Ошибка генерации'),
    })
  }

  const handleSave = async () => {
    if (!generate.data) return
    const { result } = generate.data
    const today = new Date().toISOString().slice(0, 10)

    setSaving(true)
    try {
      await workoutsApi.create({
        date: today,
        name: result.name,
        workout_type: result.workout_type,
        ...(result.duration_mins !== null ? { duration_mins: result.duration_mins } : {}),
        ...(result.notes !== null ? { raw_text: result.notes } : {}),
        source_type: 'generated',
        sections: result.sections.map((section, sectionIndex) => ({
          section_key: section.section_key,
          section_role: section.section_role,
          title: section.title,
          ...(section.description !== null ? { description: section.description } : {}),
          ...(section.notes !== null ? { notes: section.notes } : {}),
          order_index: sectionIndex,
          items: section.items.map((item, itemIndex) => ({
            name: item.name,
            ...(item.sets !== null ? { sets: item.sets } : {}),
            ...(item.reps !== null ? { reps: item.reps } : {}),
            ...(item.weight_note !== null ? { weight_note: item.weight_note } : {}),
            ...(item.prescription_text !== null
              ? { prescription_text: item.prescription_text }
              : {}),
            ...(item.notes !== null ? { notes: item.notes } : {}),
            order_index: itemIndex,
          })),
        })),
        exercises: result.exercises.map((ex, i) => ({
          name: ex.name,
          order_index: i,
          ...(ex.sets !== null ? { sets: ex.sets } : {}),
          ...(ex.reps !== null ? { reps: ex.reps } : {}),
          ...(ex.weight_note !== null ? { weight_note: ex.weight_note } : {}),
        })),
      })
      await qc.invalidateQueries({ queryKey: ['workouts'] })
      toast.success('Тренировка сохранена')
      setOpen(false)
      setPrompt('')
      generate.reset()
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = (next: boolean) => {
    if (!next) {
      setPrompt('')
      generate.reset()
    }
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="mr-2 h-4 w-4" />
          Сгенерировать
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Генерация тренировки</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Опишите тренировку... например: &quot;Верх тела, 45 мин, средняя интенсивность&quot;"
            rows={3}
            disabled={generate.isPending || generate.isSuccess}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 resize-none"
          />

          {!generate.isSuccess && (
            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={!prompt.trim() || generate.isPending}
            >
              {generate.isPending ? 'Генерирую...' : 'Сгенерировать'}
            </Button>
          )}

          {generate.isPending && (
            <div className="space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          )}

          {generate.isError && (
            <p className="text-sm text-destructive">Ошибка генерации. Попробуйте ещё раз.</p>
          )}

          {generate.isSuccess && generate.data && (
            <>
              <DraftPreview draft={generate.data.result} />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    generate.reset()
                    setPrompt('')
                  }}
                >
                  Сгенерировать заново
                </Button>
                <Button className="flex-1" onClick={handleSave} disabled={saving}>
                  {saving ? 'Сохраняю...' : 'Сохранить тренировку'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
