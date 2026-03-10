import { Button } from '@/components/ui/button'
import { useWorkoutsStore } from '@/features/workouts/store/workouts.store'
import type { WorkoutType } from '@/shared/schemas/workouts.schema'

const WORKOUT_TYPES: WorkoutType[] = [
  'for_time',
  'amrap',
  'emom',
  'tabata',
  'lifting',
  'rounds',
  'other',
]

export function WorkoutFilterBar() {
  const filters = useWorkoutsStore((s) => s.filters)
  const setFilter = useWorkoutsStore((s) => s.setFilter)
  const resetFilters = useWorkoutsStore((s) => s.resetFilters)

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
      <select
        aria-label="Filter by workout type"
        value={filters.workout_type ?? ''}
        onChange={(e) => {
          const val = e.target.value
          setFilter('workout_type', val === '' ? null : val)
        }}
        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">All types</option>
        {WORKOUT_TYPES.map((wt) => (
          <option key={wt} value={wt}>
            {wt}
          </option>
        ))}
      </select>

      <input
        type="date"
        aria-label="From date"
        value={filters.from ?? ''}
        onChange={(e) => setFilter('from', e.target.value === '' ? null : e.target.value)}
        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />

      <input
        type="date"
        aria-label="To date"
        value={filters.to ?? ''}
        onChange={(e) => setFilter('to', e.target.value === '' ? null : e.target.value)}
        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />

      <Button variant="outline" size="sm" onClick={resetFilters}>
        Reset
      </Button>
    </div>
  )
}
