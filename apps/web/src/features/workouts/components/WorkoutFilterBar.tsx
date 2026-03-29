import { Button } from '@/components/ui/button'
import { useWorkoutsStore } from '@/features/workouts/store/workouts.store'
import type { WorkoutType } from '@/shared/schemas/workouts.schema'
import { Calendar, LayoutGrid, X } from 'lucide-react'

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

  const hasFilters = filters.workout_type !== null || filters.from !== null || filters.to !== null

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
      <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
        <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <select
          aria-label="Filter by workout type"
          value={filters.workout_type ?? ''}
          onChange={(e) => {
            const val = e.target.value
            setFilter('workout_type', val === '' ? null : val)
          }}
          className="bg-background text-sm text-foreground outline-none"
        >
          <option value="">All types</option>
          {WORKOUT_TYPES.map((wt) => (
            <option key={wt} value={wt}>
              {wt}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
        <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          type="date"
          aria-label="From date"
          value={filters.from ?? ''}
          onChange={(e) => setFilter('from', e.target.value === '' ? null : e.target.value)}
          className="bg-background text-sm text-foreground outline-none [color-scheme:dark]"
        />
        <span className="text-xs text-muted-foreground">--</span>
        <input
          type="date"
          aria-label="To date"
          value={filters.to ?? ''}
          onChange={(e) => setFilter('to', e.target.value === '' ? null : e.target.value)}
          className="bg-background text-sm text-foreground outline-none [color-scheme:dark]"
        />
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}
