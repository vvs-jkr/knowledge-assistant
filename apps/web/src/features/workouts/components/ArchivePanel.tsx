import { ArchiveDetailPanel } from '@/features/workouts/components/ArchiveDetailPanel'
import { ArchiveFilterBar } from '@/features/workouts/components/ArchiveFilterBar'
import { ArchiveTable } from '@/features/workouts/components/ArchiveTable'
import { useWorkoutsStore } from '@/features/workouts/store/workouts.store'

export function ArchivePanel() {
  const selectedArchiveWorkoutId = useWorkoutsStore((s) => s.selectedArchiveWorkoutId)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ArchiveFilterBar />
      <div className="flex flex-1 overflow-hidden">
        <div
          className={`flex flex-col overflow-hidden ${selectedArchiveWorkoutId !== null ? 'flex-1' : 'w-full max-w-4xl'}`}
        >
          <ArchiveTable />
        </div>
        {selectedArchiveWorkoutId !== null && (
          <aside className="w-[30rem] shrink-0 overflow-auto border-l">
            <ArchiveDetailPanel archiveWorkoutId={selectedArchiveWorkoutId} />
          </aside>
        )}
      </div>
    </div>
  )
}
