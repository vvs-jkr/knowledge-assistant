import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useExercises, useWorkoutStats } from '@/features/workouts/api/workouts.api'
import { ExerciseProgressChart } from '@/features/workouts/components/ExerciseProgressChart'
import { TypeDonutChart } from '@/features/workouts/components/TypeDonutChart'
import { VolumeBarChart } from '@/features/workouts/components/VolumeBarChart'
import { WorkoutCalendarHeatmap } from '@/features/workouts/components/WorkoutCalendarHeatmap'
import { useWorkoutsStore } from '@/features/workouts/store/workouts.store'
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
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No stats available
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Workouts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total_workouts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total_logs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.current_streak_days} days</p>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <div className="rounded-xl border p-4">
        <p className="mb-3 text-sm font-medium">Activity</p>
        <WorkoutCalendarHeatmap data={stats.heatmap} />
      </div>

      {/* Volume + Type distribution */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border p-4">
          <p className="mb-2 text-sm font-medium">Weekly Volume</p>
          <VolumeBarChart data={stats.weekly_volume} />
        </div>
        <div className="rounded-xl border p-4">
          <p className="mb-2 text-sm font-medium">Type Distribution</p>
          <TypeDonutChart data={stats.type_distribution} />
        </div>
      </div>

      {/* Exercise progress */}
      <div className="rounded-xl border p-4">
        <p className="mb-3 text-sm font-medium">Exercise Progress</p>
        <div className="mb-3">
          <input
            list="exercises-list"
            value={exerciseSearch}
            onChange={(e) => {
              setExerciseSearch(e.target.value)
              // If user typed exactly a known exercise name, select it
              const found = exercises?.find((ex) => ex.name === e.target.value)
              if (found) {
                setSelectedExerciseId(found.id)
                setSelectedExerciseName(found.name)
              } else if (e.target.value === '') {
                setSelectedExerciseId(null)
                setSelectedExerciseName('')
              }
            }}
            placeholder="Search exercises…"
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
              ? 'No progress data for this exercise'
              : 'Select an exercise to see progress'}
          </div>
        )}
      </div>
    </div>
  )
}
