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

      <div className="space-y-1">
        {draft.exercises.map((ex, i) => (
          <div key={`${ex.name}-${i}`} className="flex items-baseline justify-between text-sm">
            <span className="font-medium">{ex.name}</span>
            <span className="text-muted-foreground">
              {[
                ex.sets !== null ? `${ex.sets} sets` : null,
                ex.reps !== null ? `× ${ex.reps}` : null,
                ex.weight_note,
              ]
                .filter(Boolean)
                .join(' ')}
            </span>
          </div>
        ))}
      </div>
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
      onError: () => toast.error('Generation failed'),
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
        duration_mins: result.duration_mins ?? undefined,
        source_type: 'generated',
        exercises: result.exercises.map((ex, i) => ({
          name: ex.name,
          sets: ex.sets ?? undefined,
          reps: ex.reps ?? undefined,
          weight_note: ex.weight_note ?? undefined,
          order_index: i,
        })),
      })
      await qc.invalidateQueries({ queryKey: ['workouts'] })
      toast.success('Workout saved')
      setOpen(false)
      setPrompt('')
      generate.reset()
    } catch {
      toast.error('Failed to save workout')
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
          Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Workout</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the workout you want… e.g. &quot;Upper body push day, 45 min, moderate intensity&quot;"
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
              {generate.isPending ? 'Generating…' : 'Generate'}
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
            <p className="text-sm text-destructive">Generation failed. Try again.</p>
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
                  Regenerate
                </Button>
                <Button className="flex-1" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save as workout'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
