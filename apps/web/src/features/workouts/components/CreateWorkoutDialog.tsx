import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useCreateWorkout, usePlans } from '@/features/workouts/api/workouts.api'
import { WORKOUT_TYPE_LABELS } from '@/features/workouts/utils/workout-display'
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
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

let rowCounter = 0
const newRowId = () => `row-${++rowCounter}`

interface ExerciseRow {
  id: string
  name: string
  sets: string
  reps: string
  weight_kg: string
  weight_note: string
}

const emptyExercise = (): ExerciseRow => ({
  id: newRowId(),
  name: '',
  sets: '',
  reps: '',
  weight_kg: '',
  weight_note: '',
})

const today = () => new Date().toISOString().slice(0, 10)

function SortableExerciseRow({
  ex,
  canRemove,
  onChange,
  onRemove,
}: {
  ex: ExerciseRow
  index: number
  canRemove: boolean
  onChange: (field: keyof ExerciseRow, value: string) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ex.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
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
        value={ex.name}
        onChange={(e) => onChange('name', e.target.value)}
        placeholder="Упражнение"
        className="min-w-0 flex-1 rounded border border-input bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
      />
      <input
        type="text"
        inputMode="numeric"
        value={ex.sets}
        onChange={(e) => onChange('sets', e.target.value.replace(/[^\d]/g, ''))}
        placeholder="п."
        title="Подходы"
        className="w-10 rounded border border-input bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
      />
      <input
        type="text"
        inputMode="numeric"
        value={ex.reps}
        onChange={(e) => onChange('reps', e.target.value.replace(/[^\d]/g, ''))}
        placeholder="р."
        title="Повторения"
        className="w-10 rounded border border-input bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
      />
      <input
        type="text"
        inputMode="decimal"
        value={ex.weight_kg}
        onChange={(e) => onChange('weight_kg', e.target.value.replace(/[^\d.]/g, ''))}
        placeholder="кг"
        title="Вес (кг)"
        className="w-14 rounded border border-input bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
      />
      <input
        type="text"
        value={ex.weight_note}
        onChange={(e) => onChange('weight_note', e.target.value)}
        placeholder="заметка / время"
        title="Заметка (время, структура)"
        className="w-24 rounded border border-input bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

interface CreateWorkoutDialogProps {
  defaultPlanId?: string
  trigger?: React.ReactNode
}

export function CreateWorkoutDialog({ defaultPlanId, trigger }: CreateWorkoutDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState(today())
  const [workoutType, setWorkoutType] = useState('other')
  const [duration, setDuration] = useState('')
  const [rounds, setRounds] = useState('')
  const [rawText, setRawText] = useState('')
  const [planId, setPlanId] = useState(defaultPlanId ?? '')
  const [exercises, setExercises] = useState<ExerciseRow[]>([emptyExercise()])

  const createWorkout = useCreateWorkout()
  const { data: plans } = usePlans()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setExercises((prev) => {
      const oldIndex = prev.findIndex((ex) => ex.id === active.id)
      const newIndex = prev.findIndex((ex) => ex.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(oldIndex, 1)
      next.splice(newIndex, 0, moved)
      return next
    })
  }

  const addExercise = () => setExercises((prev) => [...prev, emptyExercise()])
  const removeExercise = (i: number) => setExercises((prev) => prev.filter((_, idx) => idx !== i))
  const updateExercise = (i: number, field: keyof ExerciseRow, value: string) =>
    setExercises((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, [field]: value } : ex)))

  const reset = () => {
    setName('')
    setDate(today())
    setWorkoutType('other')
    setDuration('')
    setRounds('')
    setRawText('')
    setPlanId(defaultPlanId ?? '')
    setExercises([emptyExercise()])
  }

  const handleSubmit = () => {
    if (!name.trim()) return

    const exerciseInputs = exercises
      .filter((ex) => ex.name.trim())
      .map((ex, i) => ({
        name: ex.name.trim(),
        order_index: i,
        ...(ex.sets ? { sets: Number(ex.sets) } : {}),
        ...(ex.reps ? { reps: Number(ex.reps) } : {}),
        ...(ex.weight_kg ? { weight_kg: Number(ex.weight_kg) } : {}),
        ...(ex.weight_note.trim() ? { weight_note: ex.weight_note.trim() } : {}),
      }))

    createWorkout.mutate(
      {
        date,
        name: name.trim(),
        workout_type: workoutType,
        ...(duration ? { duration_mins: Number(duration) } : {}),
        ...(rounds ? { rounds: Number(rounds) } : {}),
        ...(rawText.trim() ? { raw_text: rawText.trim() } : {}),
        ...(planId ? { plan_id: planId } : {}),
        source_type: 'manual',
        exercises: exerciseInputs,
      },
      {
        onSuccess: () => {
          toast.success('Тренировка добавлена')
          setOpen(false)
          reset()
        },
        onError: () => toast.error('Ошибка сохранения'),
      }
    )
  }

  const handleClose = (next: boolean) => {
    if (!next) reset()
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Добавить
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Добавить тренировку</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Name + date row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium" htmlFor="wk-name">
                Название <span className="text-destructive">*</span>
              </label>
              <input
                id="wk-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название тренировки"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="wk-date">
                Дата
              </label>
              <input
                id="wk-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="wk-type">
                Тип
              </label>
              <select
                id="wk-type"
                value={workoutType}
                onChange={(e) => setWorkoutType(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              >
                {Object.entries(WORKOUT_TYPE_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Duration + rounds + plan */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="wk-duration">
                Длит. (мин)
              </label>
              <input
                id="wk-duration"
                type="text"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="--"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="wk-rounds">
                Раунды
              </label>
              <input
                id="wk-rounds"
                type="text"
                inputMode="numeric"
                value={rounds}
                onChange={(e) => setRounds(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="--"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="wk-plan">
                План
              </label>
              <select
                id="wk-plan"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">--</option>
                {plans?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Raw text */}
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="wk-raw">
              Текст тренировки
            </label>
            <textarea
              id="wk-raw"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Вставь текст тренировки от ассистента..."
              rows={4}
              className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Exercises */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Упражнения</span>
              <Button type="button" variant="ghost" size="sm" onClick={addExercise}>
                <Plus className="mr-1 h-3 w-3" />
                Добавить
              </Button>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={exercises.map((ex) => ex.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {exercises.map((ex, i) => (
                    <SortableExerciseRow
                      key={ex.id}
                      ex={ex}
                      index={i}
                      canRemove={exercises.length > 1}
                      onChange={(field, value) => updateExercise(i, field, value)}
                      onRemove={() => removeExercise(i)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <p className="mt-1 text-xs text-muted-foreground">
              п. = подходы, р. = повторения, заметка = время/структура
            </p>
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!name.trim() || createWorkout.isPending}
          >
            {createWorkout.isPending ? 'Сохранение...' : 'Сохранить тренировку'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
