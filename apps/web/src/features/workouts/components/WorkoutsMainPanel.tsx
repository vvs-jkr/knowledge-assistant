import { CreateWorkoutDialog } from '@/features/workouts/components/CreateWorkoutDialog'
import { GenerateWorkoutDialog } from '@/features/workouts/components/GenerateWorkoutDialog'
import { PlanDetailView } from '@/features/workouts/components/PlanDetailView'
import { PlansTab } from '@/features/workouts/components/PlansTab'
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
  const selectedPlanId = useWorkoutsStore((s) => s.selectedPlanId)

  return (
    <div className="flex h-full w-full flex-col">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center justify-between border-b pr-4">
        <div className="flex">
          {(['cards', 'plans', 'stats', 'list'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'list' ? 'Workouts' : tab === 'cards' ? 'Карточки' : tab === 'stats' ? 'Stats' : 'Планы'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <WorkoutAnalysisDialog />
          <CreateWorkoutDialog />
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

      {activeTab === 'plans' && (
        <div className="flex-1 overflow-hidden">
          {selectedPlanId !== null ? (
            <PlanDetailView planId={selectedPlanId} />
          ) : (
            <PlansTab />
          )}
        </div>
      )}
    </div>
  )
}
