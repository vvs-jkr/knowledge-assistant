import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useUpdateWorkout, useWorkout } from '@/features/workouts/api/workouts.api'
import { WorkoutExerciseList } from '@/features/workouts/components/WorkoutExerciseList'
import type { WorkoutType } from '@/shared/schemas/workouts.schema'
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

  useEffect(() => {
    if (workout) {
      setName(workout.name)
      setDate(workout.date)
      setWorkoutType(workout.workout_type)
      setDurationMins(workout.duration_mins !== null ? String(workout.duration_mins) : '')
      setRounds(workout.rounds !== null ? String(workout.rounds) : '')
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
      },
      { onSuccess: () => setEditing(false) }
    )
  }

  const handleCancel = () => {
    if (workout) {
      setName(workout.name)
      setDate(workout.date)
      setWorkoutType(workout.workout_type)
      setDurationMins(workout.duration_mins !== null ? String(workout.duration_mins) : '')
      setRounds(workout.rounds !== null ? String(workout.rounds) : '')
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

            <div className="border-t pt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Упражнения
              </p>
              <WorkoutExerciseList exercises={workout.exercises} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
