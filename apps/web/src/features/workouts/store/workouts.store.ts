import type { WorkoutType } from '@/shared/schemas/workouts.schema'
import { create } from 'zustand'

interface WorkoutsFilters {
  workout_type: WorkoutType | null
  from: string | null
  to: string | null
}

interface WorkoutsState {
  selectedWorkoutId: string | null
  activeTab: 'list' | 'cards' | 'stats'
  filters: WorkoutsFilters
  selectWorkout: (id: string | null) => void
  setActiveTab: (tab: 'list' | 'cards' | 'stats') => void
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
  filters: { ...defaultFilters },
  selectWorkout: (id) => set({ selectedWorkoutId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setFilter: (key, value) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value,
      },
    })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
}))
