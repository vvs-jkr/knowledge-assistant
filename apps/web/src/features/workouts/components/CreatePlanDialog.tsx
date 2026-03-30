import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useCreatePlan } from '@/features/workouts/api/workouts.api'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface CreatePlanDialogProps {
  trigger?: React.ReactNode
}

export function CreatePlanDialog({ trigger }: CreatePlanDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const createPlan = useCreatePlan()

  const handleSubmit = () => {
    if (!name.trim()) return
    createPlan.mutate(
      { name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}) },
      {
        onSuccess: () => {
          toast.success('План создан')
          setOpen(false)
          setName('')
          setDescription('')
        },
        onError: () => toast.error('Ошибка создания плана'),
      },
    )
  }

  const handleClose = (next: boolean) => {
    if (!next) {
      setName('')
      setDescription('')
    }
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Новый план
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Создать план</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="plan-name">
              Название <span className="text-destructive">*</span>
            </label>
            <input
              id="plan-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Неделя 1 -- Push/Pull/Legs"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="plan-desc">
              Описание
            </label>
            <textarea
              id="plan-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опциональное описание..."
              rows={2}
              className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!name.trim() || createPlan.isPending}
          >
            {createPlan.isPending ? 'Создание...' : 'Создать'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
