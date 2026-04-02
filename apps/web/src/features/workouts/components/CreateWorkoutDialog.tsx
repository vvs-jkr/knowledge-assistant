import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCreateWorkout, usePlans } from '@/features/workouts/api/workouts.api'
import { WORKOUT_TYPE_LABELS } from '@/features/workouts/utils/workout-display'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface SectionItemRow {
  id: string
  name: string
  sets: string
  reps: string
  weight_note: string
  prescription_text: string
  notes: string
}

interface SectionRow {
  id: string
  section_key: string
  section_role: 'warmup' | 'strength_skill' | 'conditioning' | 'accessory_cooldown'
  title: string
  description: string
  items: SectionItemRow[]
}

interface CreateWorkoutDialogProps {
  defaultPlanId?: string
  trigger?: React.ReactNode
}

const today = () => new Date().toISOString().slice(0, 10)

let rowCounter = 0
const newRowId = () => `row-${++rowCounter}`

const createEmptyItem = (): SectionItemRow => ({
  id: newRowId(),
  name: '',
  sets: '',
  reps: '',
  weight_note: '',
  prescription_text: '',
  notes: '',
})

const createDefaultSections = (): SectionRow[] => [
  {
    id: newRowId(),
    section_key: 'A',
    section_role: 'warmup',
    title: 'Разминка',
    description: '',
    items: [createEmptyItem()],
  },
  {
    id: newRowId(),
    section_key: 'B',
    section_role: 'strength_skill',
    title: 'Силовая / техника',
    description: '',
    items: [createEmptyItem()],
  },
  {
    id: newRowId(),
    section_key: 'C',
    section_role: 'conditioning',
    title: 'Комплекс',
    description: '',
    items: [createEmptyItem()],
  },
  {
    id: newRowId(),
    section_key: 'D',
    section_role: 'accessory_cooldown',
    title: 'Подсоба / заминка',
    description: '',
    items: [createEmptyItem()],
  },
]

export function CreateWorkoutDialog({ defaultPlanId, trigger }: CreateWorkoutDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState(today())
  const [workoutType, setWorkoutType] = useState('other')
  const [duration, setDuration] = useState('')
  const [rounds, setRounds] = useState('')
  const [rawText, setRawText] = useState('')
  const [planId, setPlanId] = useState(defaultPlanId ?? '')
  const [sections, setSections] = useState<SectionRow[]>(createDefaultSections())

  const createWorkout = useCreateWorkout()
  const { data: plans } = usePlans()

  const reset = () => {
    setName('')
    setDate(today())
    setWorkoutType('other')
    setDuration('')
    setRounds('')
    setRawText('')
    setPlanId(defaultPlanId ?? '')
    setSections(createDefaultSections())
  }

  const updateSection = (sectionId: string, patch: Partial<SectionRow>) => {
    setSections((prev) => prev.map((section) => (section.id === sectionId ? { ...section, ...patch } : section)))
  }

  const updateItem = (
    sectionId: string,
    itemId: string,
    field: keyof SectionItemRow,
    value: string
  ) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id !== sectionId
          ? section
          : {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId ? { ...item, [field]: value } : item
              ),
            }
      )
    )
  }

  const addItem = (sectionId: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, items: [...section.items, createEmptyItem()] }
          : section
      )
    )
  }

  const removeItem = (sectionId: string, itemId: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items:
                section.items.length > 1
                  ? section.items.filter((item) => item.id !== itemId)
                  : section.items,
            }
          : section
      )
    )
  }

  const handleSubmit = () => {
    if (!name.trim()) return

    const sectionInputs = sections
      .map((section, sectionIndex) => {
        const items = section.items
          .filter(
            (item) =>
              item.name.trim() ||
              item.prescription_text.trim() ||
              item.notes.trim()
          )
          .map((item, itemIndex) => ({
            ...(item.name.trim() ? { name: item.name.trim() } : {}),
            ...(item.sets ? { sets: Number(item.sets) } : {}),
            ...(item.reps ? { reps: Number(item.reps) } : {}),
            ...(item.weight_note.trim() ? { weight_note: item.weight_note.trim() } : {}),
            ...(item.prescription_text.trim()
              ? { prescription_text: item.prescription_text.trim() }
              : {}),
            ...(item.notes.trim() ? { notes: item.notes.trim() } : {}),
            order_index: itemIndex,
          }))

        return {
          section_key: section.section_key,
          section_role: section.section_role,
          title: section.title.trim() || section.section_key,
          ...(section.description.trim() ? { description: section.description.trim() } : {}),
          order_index: sectionIndex,
          items,
        }
      })
      .filter((section) => section.items.length > 0)

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
        sections: sectionInputs,
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
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Добавить тренировку</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium" htmlFor="wk-name">
                Название <span className="text-destructive">*</span>
              </label>
              <Input
                id="wk-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название тренировки"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="wk-date">
                Дата
              </label>
              <Input id="wk-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="wk-type">
                Тип
              </label>
              <select
                id="wk-type"
                value={workoutType}
                onChange={(e) => setWorkoutType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              >
                {Object.entries(WORKOUT_TYPE_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="wk-duration">
                Длит. (мин)
              </label>
              <Input
                id="wk-duration"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="--"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="wk-rounds">
                Раунды
              </label>
              <Input
                id="wk-rounds"
                inputMode="numeric"
                value={rounds}
                onChange={(e) => setRounds(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="--"
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">--</option>
                {plans?.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="wk-raw">
              Общие заметки / сырой текст
            </label>
            <Textarea
              id="wk-raw"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Общие заметки, описание сессии, контекст..."
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-4">
            {sections.map((section) => (
              <div key={section.id} className="rounded-xl border p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-md border px-2 py-1 text-sm font-semibold">
                    {section.section_key}
                  </div>
                  <Input
                    value={section.title}
                    onChange={(e) => updateSection(section.id, { title: e.target.value })}
                    placeholder="Название секции"
                  />
                </div>

                <div className="mb-3">
                  <Textarea
                    value={section.description}
                    onChange={(e) => updateSection(section.id, { description: e.target.value })}
                    placeholder="Краткое описание секции или формат работы"
                    className="min-h-[70px]"
                  />
                </div>

                <div className="space-y-2">
                  {section.items.map((item) => (
                    <div key={item.id} className="rounded-lg border border-dashed p-3">
                      <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1.4fr)_80px_80px_minmax(0,1fr)_auto]">
                        <Input
                          value={item.name}
                          onChange={(e) => updateItem(section.id, item.id, 'name', e.target.value)}
                          placeholder="Упражнение"
                        />
                        <Input
                          inputMode="numeric"
                          value={item.sets}
                          onChange={(e) =>
                            updateItem(
                              section.id,
                              item.id,
                              'sets',
                              e.target.value.replace(/[^\d]/g, '')
                            )
                          }
                          placeholder="Подх."
                        />
                        <Input
                          inputMode="numeric"
                          value={item.reps}
                          onChange={(e) =>
                            updateItem(
                              section.id,
                              item.id,
                              'reps',
                              e.target.value.replace(/[^\d]/g, '')
                            )
                          }
                          placeholder="Повт."
                        />
                        <Input
                          value={item.weight_note}
                          onChange={(e) =>
                            updateItem(section.id, item.id, 'weight_note', e.target.value)
                          }
                          placeholder="Вес / интенсивность"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(section.id, item.id)}
                          disabled={section.items.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <Textarea
                          value={item.prescription_text}
                          onChange={(e) =>
                            updateItem(section.id, item.id, 'prescription_text', e.target.value)
                          }
                          placeholder="Схема / prescription. Например: 3 раунда не спеша"
                          className="min-h-[80px]"
                        />
                        <Textarea
                          value={item.notes}
                          onChange={(e) => updateItem(section.id, item.id, 'notes', e.target.value)}
                          placeholder="Заметки"
                          className="min-h-[80px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <Button type="button" variant="ghost" size="sm" onClick={() => addItem(section.id)}>
                    <Plus className="mr-1 h-3 w-3" />
                    Добавить элемент в {section.section_key}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={!name.trim() || createWorkout.isPending}>
            {createWorkout.isPending ? 'Сохранение...' : 'Сохранить тренировку'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
