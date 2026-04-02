import type { WorkoutType } from '@/shared/schemas/workouts.schema'
import { create } from 'zustand'

interface WorkoutsFilters {
  workout_type: WorkoutType | null
  from: string | null
  to: string | null
}

interface ArchiveFilters {
  review_status: 'raw' | 'needs_review' | 'reviewed' | 'corrected' | null
  year: string | null
}

interface WorkoutsState {
  selectedWorkoutId: string | null
  selectedArchiveWorkoutId: string | null
  activeTab: 'list' | 'cards' | 'stats' | 'plans' | 'archive'
  selectedPlanId: string | null
  filters: WorkoutsFilters
  archiveFilters: ArchiveFilters
  selectWorkout: (id: string | null) => void
  selectArchiveWorkout: (id: string | null) => void
  setActiveTab: (tab: 'list' | 'cards' | 'stats' | 'plans' | 'archive') => void
  selectPlan: (id: string | null) => void
  setFilter: (key: keyof WorkoutsFilters, value: string | null) => void
  setArchiveFilter: (key: keyof ArchiveFilters, value: string | null) => void
  resetFilters: () => void
  resetArchiveFilters: () => void
}

const defaultFilters: WorkoutsFilters = {
  workout_type: null,
  from: null,
  to: null,
}

const defaultArchiveFilters: ArchiveFilters = {
  review_status: null,
  year: null,
}

export const useWorkoutsStore = create<WorkoutsState>((set) => ({
  selectedWorkoutId: null,
  selectedArchiveWorkoutId: null,
  activeTab: 'cards',
  selectedPlanId: null,
  filters: { ...defaultFilters },
  archiveFilters: { ...defaultArchiveFilters },
  selectWorkout: (id) => set({ selectedWorkoutId: id }),
  selectArchiveWorkout: (id) => set({ selectedArchiveWorkoutId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectPlan: (id) => set({ selectedPlanId: id }),
  setFilter: (key, value) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value,
      },
    })),
  setArchiveFilter: (key, value) =>
    set((state) => ({
      archiveFilters: {
        ...state.archiveFilters,
        [key]: value,
      },
    })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
  resetArchiveFilters: () => set({ archiveFilters: { ...defaultArchiveFilters } }),
}))
