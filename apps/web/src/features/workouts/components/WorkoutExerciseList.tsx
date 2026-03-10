import { Badge } from '@/components/ui/badge'
import type { WorkoutExercise } from '@/shared/schemas/workouts.schema'

interface WorkoutExerciseListProps {
  exercises: WorkoutExercise[]
}

export function WorkoutExerciseList({ exercises }: WorkoutExerciseListProps) {
  if (exercises.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
        No exercises recorded
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {exercises.map((ex) => (
        <li key={ex.id} className="rounded-md border p-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-semibold">{ex.exercise_name}</span>
            {ex.muscle_groups.map((mg) => (
              <Badge key={mg} variant="secondary" className="text-xs">
                {mg}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {ex.reps !== null && ex.sets !== null && (
              <span>
                {ex.reps} reps × {ex.sets} sets
              </span>
            )}
            {ex.reps !== null && ex.sets === null && <span>{ex.reps} reps</span>}
            {ex.reps === null && ex.sets !== null && <span>{ex.sets} sets</span>}
            {ex.weight_kg !== null && <span>{ex.weight_kg} kg</span>}
            {ex.weight_note !== null && <span>{ex.weight_note}</span>}
            {ex.duration_secs !== null && <span>{ex.duration_secs}s</span>}
            {ex.notes !== null && <span className="italic">{ex.notes}</span>}
          </div>
        </li>
      ))}
    </ul>
  )
}
