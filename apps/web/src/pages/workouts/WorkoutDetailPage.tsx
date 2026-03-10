import { Button } from '@/components/ui/button'
import { useWorkoutLogs } from '@/features/workouts/api/workouts.api'
import { WorkoutDetailPanel } from '@/features/workouts/components/WorkoutDetailPanel'
import { AppHeader } from '@/shared/ui/AppHeader'
import { useNavigate, useParams } from 'react-router-dom'

export function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: logs } = useWorkoutLogs(id ? { workout_id: id } : undefined)

  if (!id) {
    return null
  }

  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <div className="flex shrink-0 items-center gap-3 border-b px-6 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          ← Back
        </Button>
        <span className="text-sm text-muted-foreground">Workout detail</span>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-hidden">
          <WorkoutDetailPanel workoutId={id} />
        </main>
        {logs !== undefined && logs.length > 0 && (
          <aside className="w-80 shrink-0 overflow-auto border-l p-4">
            <h3 className="mb-3 text-sm font-semibold">Log History</h3>
            <ul className="flex flex-col gap-2">
              {logs.map((log) => (
                <li key={log.id} className="rounded-md border p-3 text-sm">
                  <div className="font-medium">{log.completed_at.slice(0, 10)}</div>
                  {log.duration_secs !== null && (
                    <div className="text-muted-foreground">{log.duration_secs}s</div>
                  )}
                  {log.rounds_completed !== null && (
                    <div className="text-muted-foreground">{log.rounds_completed} rounds</div>
                  )}
                  {log.notes !== null && (
                    <div className="mt-1 text-muted-foreground italic">{log.notes}</div>
                  )}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  )
}
