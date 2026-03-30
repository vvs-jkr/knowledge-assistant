import type { WorkoutType } from '@/shared/schemas/workouts.schema'
import { create } from 'zustand'

interface WorkoutsFilters {
  workout_type: WorkoutType | null
  from: string | null
  to: string | null
}

interface WorkoutsState {
  selectedWorkoutId: string | null
  activeTab: 'list' | 'cards' | 'stats' | 'plans'
  selectedPlanId: string | null
  filters: WorkoutsFilters
  selectWorkout: (id: string | null) => void
  setActiveTab: (tab: 'list' | 'cards' | 'stats' | 'plans') => void
  selectPlan: (id: string | null) => void
  setFilter: (key: keyof WorkoutsFilters, value: string | null) => void
  resetFilters: () => void
}

const defaultFilters: WorkoutsFilters = {
  workout_type: null,
  from: null,
  to: null,
}

export const useWorkoutsStore = create<WorkoutsState>((set) => ({
  selectedWorkoutId: null,
  activeTab: 'list',
  selectedPlanId: null,
  filters: { ...defaultFilters },
  selectWorkout: (id) => set({ selectedWorkoutId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectPlan: (id) => set({ selectedPlanId: id }),
  setFilter: (key, value) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value,
      },
    })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
}))
