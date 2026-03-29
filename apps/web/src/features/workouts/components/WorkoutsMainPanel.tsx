import { GenerateWorkoutDialog } from '@/features/workouts/components/GenerateWorkoutDialog'
import { WorkoutAnalysisDialog } from '@/features/workouts/components/WorkoutAnalysisDialog'
import { useWorkoutsStore } from '@/features/workouts/store/workouts.store'
import { StatsPanel } from './StatsPanel'
import { WorkoutCardGrid } from './WorkoutCardGrid'
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
      <div className="flex shrink-0 items-center justify-between border-b pr-4">
        <div className="flex">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'list'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Workouts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cards')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'cards'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Карточки
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'stats'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Stats
          </button>
        </div>
        <div className="flex items-center gap-2">
          <WorkoutAnalysisDialog />
          <GenerateWorkoutDialog />
        </div>
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

      {activeTab === 'cards' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <WorkoutFilterBar />
          <div className="flex-1 overflow-hidden">
            <WorkoutCardGrid />
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
