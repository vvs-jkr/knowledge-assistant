import {
  WORKOUT_TYPE_BADGE_COLORS,
  WORKOUT_TYPE_BORDER_COLORS,
  WORKOUT_TYPE_LABELS,
} from '@/features/workouts/utils/workout-display'
import type { WorkoutSummary, WorkoutType } from '@/shared/schemas/workouts.schema'
import { Dumbbell } from 'lucide-react'

export function WorkoutCard({
  workout,
  onClick,
  isCompleted,
}: {
  workout: WorkoutSummary
  onClick: () => void
  isCompleted?: boolean
}) {
  const type = workout.workout_type as WorkoutType
  const borderColor = WORKOUT_TYPE_BORDER_COLORS[type] ?? 'border-l-zinc-400'
  const badgeColor = WORKOUT_TYPE_BADGE_COLORS[type] ?? 'bg-zinc-100 text-zinc-600'
  const label = WORKOUT_TYPE_LABELS[type] ?? workout.workout_type
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-2 rounded-xl border border-border p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-foreground/20 border-l-4 ${borderColor} ${isCompleted ? 'bg-green-50/60 dark:bg-green-950/30' : 'bg-card'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{workout.date}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
          {label}
        </span>
      </div>

      <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
        {workout.name}
      </p>

      <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Dumbbell className="h-3 w-3" />
          <span>{workout.exercise_count}</span>
        </span>
        {workout.duration_mins !== null && <span>{workout.duration_mins} мин</span>}
        {workout.rounds !== null && <span>{workout.rounds} р.</span>}
      </div>
    </button>
  )
}
