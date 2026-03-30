import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useCreateWorkoutLog } from '@/features/workouts/api/workouts.api'
import { useState } from 'react'

interface LogWorkoutDialogProps {
  workoutId: string
  workoutName: string
}

export function LogWorkoutDialog({ workoutId, workoutName }: LogWorkoutDialogProps) {
  const [open, setOpen] = useState(false)
  const logMutation = useCreateWorkoutLog()

  const today = new Date().toISOString().slice(0, 10)
  const [completedAt, setCompletedAt] = useState(today)
  const [durationSecs, setDurationSecs] = useState('')
  const [roundsCompleted, setRoundsCompleted] = useState('')
  const [notes, setNotes] = useState('')

  const handleOpen = (value: boolean) => {
    setOpen(value)
    if (!value) {
      logMutation.reset()
      setCompletedAt(today)
      setDurationSecs('')
      setRoundsCompleted('')
      setNotes('')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    logMutation.mutate(
      {
        workout_id: workoutId,
        completed_at: completedAt,
        ...(durationSecs !== '' ? { duration_secs: Number(durationSecs) } : {}),
        ...(roundsCompleted !== '' ? { rounds_completed: Number(roundsCompleted) } : {}),
        ...(notes !== '' ? { notes } : {}),
      },
      {
        onSuccess: () => {
          setOpen(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Записать результат
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Результат тренировки</DialogTitle>
          <DialogDescription>Запись выполнения: {workoutName}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-completed-at" className="text-sm font-medium">
              Дата
            </label>
            <input
              id="log-completed-at"
              type="date"
              required
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-duration" className="text-sm font-medium">
              Длительность (сек, необязательно)
            </label>
            <input
              id="log-duration"
              type="number"
              min="0"
              value={durationSecs}
              onChange={(e) => setDurationSecs(e.target.value)}
              placeholder="например, 1800"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-rounds" className="text-sm font-medium">
              Раундов выполнено (необязательно)
            </label>
            <input
              id="log-rounds"
              type="number"
              min="0"
              value={roundsCompleted}
              onChange={(e) => setRoundsCompleted(e.target.value)}
              placeholder="например, 5"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-notes" className="text-sm font-medium">
              Заметки (необязательно)
            </label>
            <textarea
              id="log-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Как прошло?"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {logMutation.isError && (
            <p className="text-sm text-destructive">Ошибка сохранения. Попробуйте ещё раз.</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => handleOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" size="sm" disabled={logMutation.isPending}>
              {logMutation.isPending ? 'Сохраняю...' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
