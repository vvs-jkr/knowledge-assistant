import { useHealthRecords } from '@/features/health/api/health.api'
import { useKnowledgeList } from '@/features/knowledge/api/knowledge.api'
import { useNotes } from '@/features/notes/api/notes.api'
import { useWorkouts } from '@/features/workouts/api/workouts.api'

export function useSidebarCounts() {
  const notes = useNotes()
  const workouts = useWorkouts()
  const knowledge = useKnowledgeList()
  const health = useHealthRecords()

  return {
    notes: notes.data?.length ?? 0,
    workouts: workouts.data?.length ?? 0,
    knowledge: knowledge.data?.length ?? 0,
    health: health.data?.length ?? 0,
  }
}
