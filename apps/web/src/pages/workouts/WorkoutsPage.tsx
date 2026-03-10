import { WorkoutsMainPanel } from '@/features/workouts/components/WorkoutsMainPanel'
import { AppHeader } from '@/shared/ui/AppHeader'

export function WorkoutsPage() {
  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <main className="flex flex-1 overflow-hidden">
        <WorkoutsMainPanel />
      </main>
    </div>
  )
}
