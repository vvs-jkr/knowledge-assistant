import { Skeleton } from '@/components/ui/skeleton'
import { useExercises, useWorkoutStats } from '@/features/workouts/api/workouts.api'
import { ExerciseProgressChart } from '@/features/workouts/components/ExerciseProgressChart'
import { TypeDonutChart } from '@/features/workouts/components/TypeDonutChart'
import { VolumeBarChart } from '@/features/workouts/components/VolumeBarChart'
import { WorkoutCalendarHeatmap } from '@/features/workouts/components/WorkoutCalendarHeatmap'
import { useWorkoutsStore } from '@/features/workouts/store/workouts.store'
import { Activity, Flame, ScrollText } from 'lucide-react'
import { useState } from 'react'

export function StatsPanel() {
  const filters = useWorkoutsStore((s) => s.filters)
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
  const [selectedExerciseName, setSelectedExerciseName] = useState('')

  const statsParams = {
    ...(filters.from !== null ? { from: filters.from } : {}),
    ...(filters.to !== null ? { to: filters.to } : {}),
    ...(selectedExerciseId !== null ? { exercise_id: selectedExerciseId } : {}),
  }

  const { data: stats, isLoading } = useWorkoutStats(statsParams)
  const { data: exercises } = useExercises(exerciseSearch.length >= 2 ? exerciseSearch : undefined)

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Нет данных
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-4">
      {/* Summary stat blocks */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-start justify-between rounded-xl border p-4">
          <div>
            <p className="text-sm text-muted-foreground">Всего тренировок</p>
            <p className="mt-1 text-2xl font-bold">{stats.total_workouts}</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            <Activity className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="flex items-start justify-between rounded-xl border p-4">
          <div>
            <p className="text-sm text-muted-foreground">Выполнений</p>
            <p className="mt-1 text-2xl font-bold">{stats.total_logs}</p>
          </div>
          <div className="rounded-lg bg-success/10 p-2">
            <ScrollText className="h-4 w-4 text-success" />
          </div>
        </div>
        <div className="flex items-start justify-between rounded-xl border p-4">
          <div>
            <p className="text-sm text-muted-foreground">Серия</p>
            <p className="mt-1 text-2xl font-bold">{stats.current_streak_days} дн.</p>
          </div>
          <div className="rounded-lg bg-orange-500/10 p-2">
            <Flame className="h-4 w-4 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Activity + Type distribution side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border p-4">
          <p className="mb-3 text-sm font-medium">Активность</p>
          <WorkoutCalendarHeatmap data={stats.heatmap} />
        </div>
        <div className="rounded-xl border p-4">
          <p className="mb-2 text-sm font-medium">Типы тренировок</p>
          <TypeDonutChart data={stats.type_distribution} />
        </div>
      </div>

      {/* Weekly volume -- full width */}
      <div className="rounded-xl border p-4">
        <p className="mb-2 text-sm font-medium">Объём по неделям</p>
        <VolumeBarChart data={stats.weekly_volume} />
      </div>

      {/* Exercise progress */}
      <div className="rounded-xl border p-4">
        <p className="mb-3 text-sm font-medium">Прогресс упражнений</p>
        <div className="mb-3">
          <input
            list="exercises-list"
            value={exerciseSearch}
            onChange={(e) => {
              setExerciseSearch(e.target.value)
              const found = exercises?.find((ex) => ex.name === e.target.value)
              if (found) {
                setSelectedExerciseId(found.id)
                setSelectedExerciseName(found.name)
              } else if (e.target.value === '') {
                setSelectedExerciseId(null)
                setSelectedExerciseName('')
              }
            }}
            placeholder="Поиск упражнений..."
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <datalist id="exercises-list">
            {exercises?.map((ex) => (
              <option key={ex.id} value={ex.name} />
            ))}
          </datalist>
        </div>
        {selectedExerciseId !== null && stats.exercise_progress.length > 0 ? (
          <ExerciseProgressChart
            data={stats.exercise_progress}
            exerciseName={selectedExerciseName}
          />
        ) : (
          <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
            {selectedExerciseId !== null
              ? 'Нет данных по этому упражнению'
              : 'Выберите упражнение'}
          </div>
        )}
      </div>
    </div>
  )
}
