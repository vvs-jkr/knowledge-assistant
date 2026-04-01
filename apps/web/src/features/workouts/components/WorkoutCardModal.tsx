import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCreateWorkoutLog,
  useDeleteWorkout,
  useUpdateWorkout,
  useWorkout,
} from '@/features/workouts/api/workouts.api'
import {
  WORKOUT_TYPE_BADGE_COLORS,
  WORKOUT_TYPE_LABELS,
} from '@/features/workouts/utils/workout-display'
import type { WorkoutDetail, WorkoutExercise, WorkoutType } from '@/shared/schemas/workouts.schema'
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
import { CheckCircle, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

const WORKOUT_TYPES: WorkoutType[] = [
  'for_time',
  'amrap',
  'emom',
  'tabata',
  'lifting',
  'rounds',
  'wod',
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

interface WorkoutFormState {
  name: string
  date: string
  workoutType: WorkoutType
  durationMins: string
  rounds: string
  rawText: string
  exerciseDrafts: ExerciseDraft[]
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

function getWorkoutFormState(workout: WorkoutDetail): WorkoutFormState {
  return {
    name: workout.name,
    date: workout.date,
    workoutType: workout.workout_type,
    durationMins: workout.duration_mins !== null ? String(workout.duration_mins) : '',
    rounds: workout.rounds !== null ? String(workout.rounds) : '',
    rawText: workout.raw_text ?? '',
    exerciseDrafts: workout.exercises.map(toExerciseDraft),
  }
}

function buildExerciseUpdatePayload(exerciseDrafts: ExerciseDraft[]) {
  return exerciseDrafts
    .filter((draft) => draft.exercise_id || draft.name.trim())
    .map((draft, index) => {
      const base = draft.exercise_id
        ? { exercise_id: draft.exercise_id }
        : { name: draft.name.trim() }
      return {
        ...base,
        ...(draft.reps !== '' ? { reps: Number(draft.reps) } : {}),
        ...(draft.sets !== '' ? { sets: Number(draft.sets) } : {}),
        ...(draft.weight_kg !== '' ? { weight_kg: Number(draft.weight_kg) } : {}),
        ...(draft.weight_note ? { weight_note: draft.weight_note } : {}),
        ...(draft.duration_secs !== '' ? { duration_secs: Number(draft.duration_secs) } : {}),
        order_index: index,
      }
    })
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
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
      <input
        type="text"
        value={draft.name}
        onChange={(e) => onChange({ ...draft, name: e.target.value, exercise_id: '' })}
        placeholder="Название упражнения"
        className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="flex shrink-0 gap-3">
        <NumField
          label="подх."
          value={draft.sets}
          onChange={(v) => onChange({ ...draft, sets: v })}
        />
        <NumField
          label="повт."
          value={draft.reps}
          onChange={(v) => onChange({ ...draft, reps: v })}
        />
        <NumField
          label="кг"
          value={draft.weight_kg}
          onChange={(v) => onChange({ ...draft, weight_kg: v })}
        />
      </div>
      <input
        type="text"
        value={draft.weight_note}
        onChange={(e) => onChange({ ...draft, weight_note: e.target.value })}
        placeholder="заметка / время"
        className="w-28 shrink-0 rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
      />
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

interface WorkoutHeaderActionsProps {
  createLogPending: boolean
  deletePending: boolean
  confirmDelete: boolean
  onCreateLog: () => void
  onStartEdit: () => void
  onConfirmDelete: () => void
  onDelete: () => void
  onCancelDelete: () => void
}

function WorkoutHeaderActions({
  createLogPending,
  deletePending,
  confirmDelete,
  onCreateLog,
  onStartEdit,
  onConfirmDelete,
  onDelete,
  onCancelDelete,
}: WorkoutHeaderActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs text-green-600 hover:text-green-600 dark:text-green-400"
        disabled={createLogPending}
        onClick={onCreateLog}
      >
        <CheckCircle className="h-3.5 w-3.5" />
        Выполнено
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onStartEdit}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      {confirmDelete ? (
        <div className="flex items-center gap-1">
          <Button
            variant="destructive"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onDelete}
            disabled={deletePending}
          >
            Удалить
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onCancelDelete}>
            Нет
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onConfirmDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

interface WorkoutMetaSectionProps {
  editing: boolean
  date: string
  workoutType: WorkoutType
  durationMins: string
  rounds: string
  workout: WorkoutDetail
  onDateChange: (value: string) => void
  onWorkoutTypeChange: (value: WorkoutType) => void
  onDurationMinsChange: (value: string) => void
  onRoundsChange: (value: string) => void
}

function WorkoutMetaSection({
  editing,
  date,
  workoutType,
  durationMins,
  rounds,
  workout,
  onDateChange,
  onWorkoutTypeChange,
  onDurationMinsChange,
  onRoundsChange,
}: WorkoutMetaSectionProps) {
  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{workout.date}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${WORKOUT_TYPE_BADGE_COLORS[workout.workout_type] ?? 'bg-zinc-100 text-zinc-600'}`}
        >
          {WORKOUT_TYPE_LABELS[workout.workout_type] ?? workout.workout_type}
        </span>
        {!!workout.duration_mins && <span>{workout.duration_mins} мин</span>}
        {!!workout.rounds && <span>{workout.rounds} раундов</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <Input
        type="date"
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
        className="w-36"
      />
      <select
        value={workoutType}
        onChange={(e) => onWorkoutTypeChange(e.target.value as WorkoutType)}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {WORKOUT_TYPES.map((type) => (
          <option key={type} value={type}>
            {WORKOUT_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>мин</span>
        <Input
          aria-label="Минуты"
          type="text"
          inputMode="numeric"
          value={durationMins}
          onChange={(e) => onDurationMinsChange(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="--"
          className="w-16"
        />
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>раундов</span>
        <Input
          aria-label="Раунды"
          type="text"
          inputMode="numeric"
          value={rounds}
          onChange={(e) => onRoundsChange(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="--"
          className="w-16"
        />
      </div>
    </div>
  )
}

interface WorkoutRawTextSectionProps {
  editing: boolean
  rawText: string
  rawTextOpen: boolean
  onRawTextChange: (value: string) => void
  onToggle: () => void
}

function WorkoutRawTextSection({
  editing,
  rawText,
  rawTextOpen,
  onRawTextChange,
  onToggle,
}: WorkoutRawTextSectionProps) {
  if (editing) {
    return (
      <textarea
        value={rawText}
        onChange={(e) => onRawTextChange(e.target.value)}
        placeholder="Описание / структура (например: 2-4-6-8-10, EMOM 20 min...)"
        className="w-full resize-y overflow-y-auto rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        style={{ minHeight: '4.5rem', maxHeight: '15rem' }}
      />
    )
  }

  if (!rawText) return null

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <span>{rawTextOpen ? '▾' : '▸'}</span>
        <span>Описание тренировки</span>
      </button>
      {rawTextOpen && (
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{rawText}</p>
      )}
    </div>
  )
}

interface WorkoutExercisesSectionProps {
  editing: boolean
  exerciseDrafts: ExerciseDraft[]
  workoutExercises: WorkoutExercise[]
  sensors: ReturnType<typeof useSensors>
  onDragEnd: (event: DragEndEvent) => void
  onDraftChange: (index: number, updated: ExerciseDraft) => void
  onDraftRemove: (index: number) => void
  onDraftAdd: () => void
}

function WorkoutExercisesSection({
  editing,
  exerciseDrafts,
  workoutExercises,
  sensors,
  onDragEnd,
  onDraftChange,
  onDraftRemove,
  onDraftAdd,
}: WorkoutExercisesSectionProps) {
  return (
    <div className="pt-1">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Упражнения
      </p>
      {editing ? (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={exerciseDrafts.map((draft) => draft.draftId)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {exerciseDrafts.map((draft, index) => (
                  <ExerciseEditRow
                    key={draft.draftId}
                    id={draft.draftId}
                    draft={draft}
                    onChange={(updated) => onDraftChange(index, updated)}
                    onRemove={() => onDraftRemove(index)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button
            type="button"
            onClick={onDraftAdd}
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Добавить упражнение
          </button>
        </>
      ) : workoutExercises.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет упражнений</p>
      ) : (
        <div className="space-y-0.5">
          {workoutExercises.map((exercise) => (
            <ExerciseViewRow key={exercise.id} ex={exercise} />
          ))}
        </div>
      )}
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
  const createLog = useCreateWorkoutLog()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [workoutType, setWorkoutType] = useState<WorkoutType>('other')
  const [durationMins, setDurationMins] = useState('')
  const [rounds, setRounds] = useState('')
  const [rawText, setRawText] = useState('')
  const [rawTextOpen, setRawTextOpen] = useState(false)
  const [exerciseDrafts, setExerciseDrafts] = useState<ExerciseDraft[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
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
      const nextState = getWorkoutFormState(workout)
      setName(nextState.name)
      setDate(nextState.date)
      setWorkoutType(nextState.workoutType)
      setDurationMins(nextState.durationMins)
      setRounds(nextState.rounds)
      setRawText(nextState.rawText)
      setExerciseDrafts(nextState.exerciseDrafts)
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
        raw_text: rawText.trim() || null,
        exercises: buildExerciseUpdatePayload(exerciseDrafts),
      },
      { onSuccess: () => setEditing(false) }
    )
  }

  const handleCancel = () => {
    if (workout) {
      const nextState = getWorkoutFormState(workout)
      setName(nextState.name)
      setDate(nextState.date)
      setWorkoutType(nextState.workoutType)
      setDurationMins(nextState.durationMins)
      setRounds(nextState.rounds)
      setRawText(nextState.rawText)
      setExerciseDrafts(nextState.exerciseDrafts)
    }
    setEditing(false)
  }

  const handleCreateLog = () => {
    if (!workout) return
    const today = new Date().toISOString().slice(0, 10)
    createLog.mutate(
      { workout_id: workout.id, completed_at: today },
      { onSuccess: () => toast.success('Выполнено!') }
    )
  }

  const handleDraftChange = (index: number, updated: ExerciseDraft) => {
    setExerciseDrafts((prev) =>
      prev.map((draft, currentIndex) => (currentIndex === index ? updated : draft))
    )
  }

  const handleDraftRemove = (index: number) => {
    setExerciseDrafts((prev) => prev.filter((_, currentIndex) => currentIndex !== index))
  }

  const handleDraftAdd = () => {
    setExerciseDrafts((prev) => [
      ...prev,
      {
        draftId: newDraftId(),
        exercise_id: '',
        name: '',
        sets: '',
        reps: '',
        weight_kg: '',
        weight_note: '',
        duration_secs: '',
        order_index: prev.length,
      },
    ])
  }

  return (
    <Dialog
      open={workoutId !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-x-hidden overflow-y-auto">
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
                  <WorkoutHeaderActions
                    createLogPending={createLog.isPending}
                    deletePending={deleteWorkout.isPending}
                    confirmDelete={confirmDelete}
                    onCreateLog={handleCreateLog}
                    onStartEdit={() => setEditing(true)}
                    onConfirmDelete={() => setConfirmDelete(true)}
                    onDelete={handleDelete}
                    onCancelDelete={() => setConfirmDelete(false)}
                  />
                )}
              </div>
            </DialogHeader>

            <WorkoutMetaSection
              editing={editing}
              date={date}
              workoutType={workoutType}
              durationMins={durationMins}
              rounds={rounds}
              workout={workout}
              onDateChange={setDate}
              onWorkoutTypeChange={setWorkoutType}
              onDurationMinsChange={setDurationMins}
              onRoundsChange={setRounds}
            />

            <WorkoutRawTextSection
              editing={editing}
              rawText={rawText}
              rawTextOpen={rawTextOpen}
              onRawTextChange={setRawText}
              onToggle={() => setRawTextOpen((open) => !open)}
            />

            <WorkoutExercisesSection
              editing={editing}
              exerciseDrafts={exerciseDrafts}
              workoutExercises={workout.exercises}
              sensors={sensors}
              onDragEnd={handleDragEnd}
              onDraftChange={handleDraftChange}
              onDraftRemove={handleDraftRemove}
              onDraftAdd={handleDraftAdd}
            />

            {editing && (
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={handleCancel}>
                  <X className="mr-1 h-3.5 w-3.5" />
                  Отмена
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateWorkout.isPending}>
                  Сохранить
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
