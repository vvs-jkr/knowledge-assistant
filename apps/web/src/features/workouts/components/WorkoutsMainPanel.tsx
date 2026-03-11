import { useWorkoutsStore } from '@/features/workouts/store/workouts.store'
import { StatsPanel } from './StatsPanel'
import { WorkoutDetailPanel } from './WorkoutDetailPanel'
import { WorkoutFilterBar } from './WorkoutFilterBar'
import { WorkoutTable } from './WorkoutTable'

export function WorkoutsMainPanel() {
  const activeTab = useWorkoutsStore((s) => s.activeTab)
  const setActiveTab = useWorkoutsStore((s) => s.setActiveTab)
  const selectedWorkoutId = useWorkoutsStore((s) => s.selectedWorkoutId)

  return (
    <div className="flex h-full w-full flex-col">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'list'
              ? 'border-b-2 border-foreground text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Workouts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'stats'
              ? 'border-b-2 border-foreground text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Stats
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'list' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <WorkoutFilterBar />
          <div className="flex flex-1 overflow-hidden">
            <div
              className={`flex flex-col overflow-hidden ${selectedWorkoutId !== null ? 'flex-1' : 'w-full max-w-3xl'}`}
            >
              <WorkoutTable />
            </div>
            {selectedWorkoutId !== null && (
              <aside className="w-96 shrink-0 overflow-auto border-l">
                <WorkoutDetailPanel workoutId={selectedWorkoutId} />
              </aside>
            )}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="flex-1 overflow-hidden">
          <StatsPanel />
        </div>
      )}
    </div>
  )
}
