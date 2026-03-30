import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkouts } from '@/features/workouts/api/workouts.api'
import { WorkoutCard } from '@/features/workouts/components/WorkoutCard'
import { WorkoutCardModal } from '@/features/workouts/components/WorkoutCardModal'
import { useWorkoutsStore } from '@/features/workouts/store/workouts.store'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

const PAGE_SIZE = 24

export function WorkoutCardGrid() {
  const filters = useWorkoutsStore((s) => s.filters)
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const queryParams = {
    ...(filters.workout_type !== null ? { workout_type: filters.workout_type } : {}),
    ...(filters.from !== null ? { from: filters.from } : {}),
    ...(filters.to !== null ? { to: filters.to } : {}),
  }

  const { data: workouts, isLoading } = useWorkouts(queryParams)

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: PAGE_SIZE }, (_, i) => `sk-${i}`).map((k) => (
          <Skeleton key={k} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!workouts?.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Нет тренировок
      </div>
    )
  }

  const totalPages = Math.ceil(workouts.length / PAGE_SIZE)
  const pageItems = workouts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {pageItems.map((w) => (
            <WorkoutCard key={w.id} workout={w} onClick={() => setSelectedId(w.id)} />
          ))}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex shrink-0 items-center justify-between border-t px-4 py-2 text-sm text-muted-foreground">
          <span>
            {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, workouts.length)} из{' '}
            {workouts.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <WorkoutCardModal workoutId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  )
}
