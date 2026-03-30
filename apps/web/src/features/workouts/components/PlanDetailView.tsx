import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeletePlan, usePlan } from '@/features/workouts/api/workouts.api'
import { WorkoutCard } from '@/features/workouts/components/WorkoutCard'
import { WorkoutCardModal } from '@/features/workouts/components/WorkoutCardModal'
import { CreateWorkoutDialog } from '@/features/workouts/components/CreateWorkoutDialog'
import { useWorkoutsStore } from '@/features/workouts/store/workouts.store'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export function PlanDetailView({ planId }: { planId: string }) {
  const selectPlan = useWorkoutsStore((s) => s.selectPlan)
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: plan, isLoading } = usePlan(planId)
  const deletePlan = useDeletePlan()

  const handleDelete = () => {
    deletePlan.mutate(planId, {
      onSuccess: () => {
        toast.success('План удалён')
        selectPlan(null)
      },
      onError: () => toast.error('Ошибка удаления'),
    })
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="mb-4 h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => `sk-${i}`).map((k) => (
            <Skeleton key={k} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        План не найден
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => selectPlan(null)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Планы
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold">{plan.name}</span>
          {plan.description && (
            <span className="text-sm text-muted-foreground">-- {plan.description}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CreateWorkoutDialog
            defaultPlanId={planId}
            trigger={
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Добавить
              </Button>
            }
          />
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Удалить?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deletePlan.isPending}
              >
                Да
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Нет
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Workout cards */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {plan.workouts.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            В плане нет тренировок. Добавь первую!
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {plan.workouts.map((w) => (
              <WorkoutCard
                key={w.id}
                workout={w}
                onClick={() => setSelectedWorkoutId(w.id)}
              />
            ))}
          </div>
        )}
      </div>

      <WorkoutCardModal workoutId={selectedWorkoutId} onClose={() => setSelectedWorkoutId(null)} />
    </div>
  )
}
