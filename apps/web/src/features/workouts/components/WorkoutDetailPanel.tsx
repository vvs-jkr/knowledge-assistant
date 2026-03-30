import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkout } from '@/features/workouts/api/workouts.api'
import { LogWorkoutDialog } from '@/features/workouts/components/LogWorkoutDialog'
import { WorkoutExerciseList } from '@/features/workouts/components/WorkoutExerciseList'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

interface WorkoutDetailPanelProps {
  workoutId: string
}

export function WorkoutDetailPanel({ workoutId }: WorkoutDetailPanelProps) {
  const { data: workout, isLoading } = useWorkout(workoutId)
  const [showRaw, setShowRaw] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Тренировка не найдена
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 overflow-auto p-6">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xl font-semibold">{workout.name}</h2>
        <LogWorkoutDialog workoutId={workout.id} workoutName={workout.name} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{workout.date}</span>
        <Badge variant="secondary">{workout.workout_type}</Badge>
        {workout.duration_mins !== null && <span>{workout.duration_mins} мин</span>}
        {workout.rounds !== null && <span>{workout.rounds} раундов</span>}
      </div>

      <WorkoutExerciseList exercises={workout.exercises} />

      {workout.raw_text !== null && (
        <div className="rounded-md border">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium hover:bg-muted/50"
            onClick={() => setShowRaw((prev) => !prev)}
          >
            {showRaw ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            {showRaw ? 'Скрыть оригинал' : 'Показать оригинал'}
          </button>
          {showRaw && (
            <pre className="overflow-auto px-4 pb-4 text-xs text-muted-foreground whitespace-pre-wrap">
              {workout.raw_text}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
