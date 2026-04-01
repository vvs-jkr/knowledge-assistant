import { Skeleton } from '@/components/ui/skeleton'
import { usePlans } from '@/features/workouts/api/workouts.api'
import { CreatePlanDialog } from '@/features/workouts/components/CreatePlanDialog'
import { useWorkoutsStore } from '@/features/workouts/store/workouts.store'
import type { WorkoutPlanSummary } from '@/shared/schemas/workouts.schema'
import { Dumbbell, Plus } from 'lucide-react'

function PlanCard({
  plan,
  onClick,
}: {
  plan: WorkoutPlanSummary
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-foreground/20"
    >
      <p className="text-sm font-semibold leading-snug text-foreground">{plan.name}</p>
      {plan.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{plan.description}</p>
      )}
      <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Dumbbell className="h-3 w-3" />
          <span>{plan.workout_count}</span>
        </span>
        <span>{plan.updated_at.slice(0, 10)}</span>
      </div>
    </button>
  )
}

export function PlansTab() {
  const { data: plans, isLoading } = usePlans()
  const selectPlan = useWorkoutsStore((s) => s.selectPlan)

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => `sk-${i}`).map((k) => (
          <Skeleton key={k} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {/* "New plan" card */}
        <CreatePlanDialog
          trigger={
            <button
              type="button"
              className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <Plus className="h-5 w-5" />
              <span className="text-sm">Новый план</span>
            </button>
          }
        />

        {plans?.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onClick={() => selectPlan(plan.id)} />
        ))}
      </div>

      {!isLoading && !plans?.length && (
        <p className="mt-6 text-center text-sm text-muted-foreground">Нет планов. Создай первый!</p>
      )}
    </div>
  )
}
