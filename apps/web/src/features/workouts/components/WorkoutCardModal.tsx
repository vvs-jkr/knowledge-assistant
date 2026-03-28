import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useUpdateWorkout, useWorkout } from '@/features/workouts/api/workouts.api'
import type { WorkoutExercise, WorkoutType } from '@/shared/schemas/workouts.schema'
import { Pencil, X } from 'lucide-react'
import { useEffect, useState } from 'react'

const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  for_time: 'For Time',
  amrap: 'AMRAP',
  emom: 'EMOM',
  tabata: 'Tabata',
  lifting: 'Lifting',
  rounds: 'Rounds',
  other: 'Other',
}

const WORKOUT_TYPES: WorkoutType[] = [
  'for_time',
  'amrap',
  'emom',
  'tabata',
  'lifting',
  'rounds',
  'other',
]

interface ExerciseDraft {
  exercise_id: string
  name: string
  reps: string
  sets: string
  weight_kg: string
  weight_note: string
  duration_secs: string
  order_index: number
}

function toExerciseDraft(ex: WorkoutExercise): ExerciseDraft {
  return {
    exercise_id: ex.exercise_id,
    name: ex.exercise_name,
    reps: ex.reps !== null ? String(ex.reps) : '',
    sets: ex.sets !== null ? String(ex.sets) : '',
    weight_kg: ex.weight_kg !== null ? String(ex.weight_kg) : '',
    weight_note: ex.weight_note ?? '',
    duration_secs: ex.duration_secs !== null ? String(ex.duration_secs) : '',
    order_index: ex.order_index,
  }
}

function ExerciseViewRow({ ex }: { ex: WorkoutExercise }) {
  const parts: string[] = []
  if (ex.sets !== null && ex.reps !== null) parts.push(`${ex.sets}x${ex.reps}`)
  else if (ex.reps !== null) parts.push(`${ex.reps} повт.`)
  else if (ex.sets !== null) parts.push(`${ex.sets} подх.`)
  if (ex.weight_kg !== null) parts.push(`${ex.weight_kg} кг`)
  if (ex.weight_note) parts.push(ex.weight_note)
  if (ex.duration_secs !== null) parts.push(`${ex.duration_secs}с`)

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm font-medium">{ex.exercise_name}</span>
      {parts.length > 0 && (
        <span className="shrink-0 text-xs text-muted-foreground">{parts.join(' · ')}</span>
      )}
    </div>
  )
}

function ExerciseEditRow({
  draft,
  onChange,
}: {
  draft: ExerciseDraft
  onChange: (d: ExerciseDraft) => void
}) {
  return (
    <div className="flex flex-col gap-1 py-1.5">
      <span className="text-sm font-medium">{draft.name}</span>
      <div className="flex flex-wrap gap-1.5">
        <Input
          type="number"
          value={draft.sets}
          onChange={(e) => onChange({ ...draft, sets: e.target.value })}
          placeholder="подх."
          className="h-7 w-16 text-xs"
        />
        <Input
          type="number"
          value={draft.reps}
          onChange={(e) => onChange({ ...draft, reps: e.target.value })}
          placeholder="повт."
          className="h-7 w-16 text-xs"
        />
        <Input
          type="number"
          value={draft.weight_kg}
          onChange={(e) => onChange({ ...draft, weight_kg: e.target.value })}
          placeholder="кг"
          className="h-7 w-16 text-xs"
        />
        <Input
          type="number"
          value={draft.duration_secs}
          onChange={(e) => onChange({ ...draft, duration_secs: e.target.value })}
          placeholder="сек"
          className="h-7 w-16 text-xs"
        />
      </div>
    </div>
  )
}

interface WorkoutCardModalProps {
  workoutId: string | null
  onClose: () => void
}

export function WorkoutCardModal({ workoutId, onClose }: WorkoutCardModalProps) {
  const { data: workout, isLoading } = useWorkout(workoutId ?? '')
  const updateWorkout = useUpdateWorkout()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [workoutType, setWorkoutType] = useState<WorkoutType>('other')
  const [durationMins, setDurationMins] = useState('')
  const [rounds, setRounds] = useState('')
  const [exerciseDrafts, setExerciseDrafts] = useState<ExerciseDraft[]>([])

  useEffect(() => {
    if (workout) {
      setName(workout.name)
      setDate(workout.date)
      setWorkoutType(workout.workout_type)
      setDurationMins(workout.duration_mins !== null ? String(workout.duration_mins) : '')
      setRounds(workout.rounds !== null ? String(workout.rounds) : '')
      setExerciseDrafts(workout.exercises.map(toExerciseDraft))
    }
  }, [workout])

  useEffect(() => {
    if (!workoutId) setEditing(false)
  }, [workoutId])

  const handleSave = () => {
    if (!workout) return
    const trimmed = name.trim()
    updateWorkout.mutate(
      {
        id: workout.id,
        ...(trimmed ? { name: trimmed } : {}),
        date,
        workout_type: workoutType,
        duration_mins: durationMins !== '' ? Number(durationMins) : null,
        rounds: rounds !== '' ? Number(rounds) : null,
        exercises: exerciseDrafts.map((d) => ({
          exercise_id: d.exercise_id,
          ...(d.reps !== '' ? { reps: Number(d.reps) } : {}),
          ...(d.sets !== '' ? { sets: Number(d.sets) } : {}),
          ...(d.weight_kg !== '' ? { weight_kg: Number(d.weight_kg) } : {}),
          ...(d.weight_note ? { weight_note: d.weight_note } : {}),
          ...(d.duration_secs !== '' ? { duration_secs: Number(d.duration_secs) } : {}),
          order_index: d.order_index,
        })),
      },
      { onSuccess: () => setEditing(false) },
    )
  }

  const handleCancel = () => {
    if (workout) {
      setName(workout.name)
      setDate(workout.date)
      setWorkoutType(workout.workout_type)
      setDurationMins(workout.duration_mins !== null ? String(workout.duration_mins) : '')
      setRounds(workout.rounds !== null ? String(workout.rounds) : '')
      setExerciseDrafts(workout.exercises.map(toExerciseDraft))
    }
    setEditing(false)
  }

  return (
    <Dialog
      open={workoutId !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        {isLoading || !workout ? (
          <div className="space-y-3 p-2">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-2 pr-6">
                {editing ? (
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-lg font-semibold"
                  />
                ) : (
                  <DialogTitle className="text-xl leading-tight">{workout.name}</DialogTitle>
                )}
                {!editing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {editing ? (
                <>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-36"
                  />
                  <select
                    value={workoutType}
                    onChange={(e) => setWorkoutType(e.target.value as WorkoutType)}
                    className="rounded-md border border-input bg-transparent px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {WORKOUT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {WORKOUT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    value={durationMins}
                    onChange={(e) => setDurationMins(e.target.value)}
                    placeholder="мин"
                    className="w-20"
                  />
                  <Input
                    type="number"
                    value={rounds}
                    onChange={(e) => setRounds(e.target.value)}
                    placeholder="раунды"
                    className="w-24"
                  />
                </>
              ) : (
                <>
                  <span>{workout.date}</span>
                  <Badge variant="secondary">{workout.workout_type}</Badge>
                  {workout.duration_mins !== null && <span>{workout.duration_mins} мин</span>}
                  {workout.rounds !== null && <span>{workout.rounds} раундов</span>}
                </>
              )}
            </div>

            {editing && (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={updateWorkout.isPending}>
                  Сохранить
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancel}>
                  <X className="mr-1 h-3.5 w-3.5" />
                  Отмена
                </Button>
              </div>
            )}

            <div className="pt-1">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Упражнения
              </p>
              {workout.exercises.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет упражнений</p>
              ) : editing ? (
                <div className="space-y-1">
                  {exerciseDrafts.map((d, i) => (
                    <ExerciseEditRow
                      key={d.exercise_id}
                      draft={d}
                      onChange={(updated) =>
                        setExerciseDrafts((prev) => prev.map((x, j) => (j === i ? updated : x)))
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {workout.exercises.map((ex) => (
                    <ExerciseViewRow key={ex.id} ex={ex} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
