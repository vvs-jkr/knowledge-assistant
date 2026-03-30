import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeleteWorkout, useUpdateWorkout, useWorkout } from '@/features/workouts/api/workouts.api'
import {
  WORKOUT_TYPE_BADGE_COLORS,
  WORKOUT_TYPE_LABELS,
  normalizeWorkoutName,
} from '@/features/workouts/utils/workout-display'
import type { WorkoutExercise, WorkoutType } from '@/shared/schemas/workouts.schema'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

const WORKOUT_TYPES: WorkoutType[] = [
  'for_time',
  'amrap',
  'emom',
  'tabata',
  'lifting',
  'rounds',
  'other',
]

let draftCounter = 0
const newDraftId = () => `draft-${++draftCounter}`

interface ExerciseDraft {
  draftId: string
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
    draftId: newDraftId(),
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

function NumField({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className="w-8 shrink-0">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
        className="w-14 rounded border border-input bg-background px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </label>
  )
}

function ExerciseEditRow({
  id,
  draft,
  onChange,
  onRemove,
}: {
  id: string
  draft: ExerciseDraft
  onChange: (d: ExerciseDraft) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-1">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {draft.exercise_id ? (
        <span className="min-w-0 flex-1 text-sm font-medium">{draft.name}</span>
      ) : (
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="Название упражнения"
          className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      )}
      <div className="flex shrink-0 gap-3">
        <NumField label="подх." value={draft.sets} onChange={(v) => onChange({ ...draft, sets: v })} />
        <NumField label="повт." value={draft.reps} onChange={(v) => onChange({ ...draft, reps: v })} />
        <NumField label="кг" value={draft.weight_kg} onChange={(v) => onChange({ ...draft, weight_kg: v })} />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
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
  const deleteWorkout = useDeleteWorkout()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [workoutType, setWorkoutType] = useState<WorkoutType>('other')
  const [durationMins, setDurationMins] = useState('')
  const [rounds, setRounds] = useState('')
  const [exerciseDrafts, setExerciseDrafts] = useState<ExerciseDraft[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setExerciseDrafts((prev) => {
      const oldIndex = prev.findIndex((d) => d.draftId === active.id)
      const newIndex = prev.findIndex((d) => d.draftId === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(oldIndex, 1)
      next.splice(newIndex, 0, moved)
      return next
    })
  }

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
    if (!workoutId) {
      setEditing(false)
      setConfirmDelete(false)
    }
  }, [workoutId])

  const handleDelete = () => {
    if (!workout) return
    deleteWorkout.mutate(workout.id, {
      onSuccess: () => {
        toast.success('Тренировка удалена')
        onClose()
      },
      onError: () => toast.error('Ошибка удаления'),
    })
  }

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
        exercises: exerciseDrafts
          .filter((d) => d.exercise_id || d.name.trim())
          .map((d, i) => ({
            ...(d.exercise_id ? { exercise_id: d.exercise_id } : { name: d.name.trim() }),
            ...(d.reps !== '' ? { reps: Number(d.reps) } : {}),
            ...(d.sets !== '' ? { sets: Number(d.sets) } : {}),
            ...(d.weight_kg !== '' ? { weight_kg: Number(d.weight_kg) } : {}),
            ...(d.weight_note ? { weight_note: d.weight_note } : {}),
            ...(d.duration_secs !== '' ? { duration_secs: Number(d.duration_secs) } : {}),
            order_index: i,
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
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
                  <DialogTitle className="text-xl leading-tight">{normalizeWorkoutName(workout.name)}</DialogTitle>
                )}
                {!editing && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditing(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {confirmDelete ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={handleDelete}
                          disabled={deleteWorkout.isPending}
                        >
                          Удалить
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setConfirmDelete(false)}
                        >
                          Нет
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmDelete(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
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
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {WORKOUT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {WORKOUT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={durationMins}
                    onChange={(e) => setDurationMins(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="мин"
                    className="w-20"
                  />
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={rounds}
                    onChange={(e) => setRounds(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="раунды"
                    className="w-24"
                  />
                </>
              ) : (
                <>
                  <span>{workout.date}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${WORKOUT_TYPE_BADGE_COLORS[workout.workout_type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                    {WORKOUT_TYPE_LABELS[workout.workout_type] ?? workout.workout_type}
                  </span>
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
              {editing ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={exerciseDrafts.map((d) => d.draftId)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1">
                      {exerciseDrafts.map((d, i) => (
                        <ExerciseEditRow
                          key={d.draftId}
                          id={d.draftId}
                          draft={d}
                          onChange={(updated) =>
                            setExerciseDrafts((prev) => prev.map((x, j) => (j === i ? updated : x)))
                          }
                          onRemove={() =>
                            setExerciseDrafts((prev) => prev.filter((_, j) => j !== i))
                          }
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : undefined}
              {editing && (
                  <button
                    type="button"
                    onClick={() =>
                      setExerciseDrafts((prev) => [
                        ...prev,
                        { draftId: newDraftId(), exercise_id: '', name: '', sets: '', reps: '', weight_kg: '', weight_note: '', duration_secs: '', order_index: prev.length },
                      ])
                    }
                    className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    Добавить упражнение
                  </button>
              )}
              {!editing && (
                workout.exercises.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет упражнений</p>
                ) : (
                  <div className="space-y-0.5">
                    {workout.exercises.map((ex) => (
                      <ExerciseViewRow key={ex.id} ex={ex} />
                    ))}
                  </div>
                )
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
