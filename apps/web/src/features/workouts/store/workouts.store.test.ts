import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkoutsStore } from './workouts.store'

beforeEach(() => {
  useWorkoutsStore.setState({
    selectedWorkoutId: null,
    selectedArchiveWorkoutId: null,
    activeTab: 'list',
    selectedPlanId: null,
    filters: { workout_type: null, from: null, to: null },
    archiveFilters: { review_status: null, year: null },
  })
})

describe('useWorkoutsStore', () => {
  it('starts with null selectedWorkoutId and list tab', () => {
    const state = useWorkoutsStore.getState()
    expect(state.selectedWorkoutId).toBeNull()
    expect(state.activeTab).toBe('list')
    expect(state.filters).toEqual({ workout_type: null, from: null, to: null })
  })

  it('selectWorkout sets selectedWorkoutId', () => {
    useWorkoutsStore.getState().selectWorkout('workout-1')
    expect(useWorkoutsStore.getState().selectedWorkoutId).toBe('workout-1')
  })

  it('selectWorkout with null clears selection', () => {
    useWorkoutsStore.getState().selectWorkout('workout-1')
    useWorkoutsStore.getState().selectWorkout(null)
    expect(useWorkoutsStore.getState().selectedWorkoutId).toBeNull()
  })

  it('setActiveTab updates activeTab', () => {
    useWorkoutsStore.getState().setActiveTab('stats')
    expect(useWorkoutsStore.getState().activeTab).toBe('stats')
  })

  it('setFilter updates specific filter key', () => {
    useWorkoutsStore.getState().setFilter('workout_type', 'amrap')
    const { filters } = useWorkoutsStore.getState()
    expect(filters.workout_type).toBe('amrap')
    expect(filters.from).toBeNull()
    expect(filters.to).toBeNull()
  })

  it('setFilter with null clears a filter', () => {
    useWorkoutsStore.getState().setFilter('from', '2026-01-01')
    useWorkoutsStore.getState().setFilter('from', null)
    expect(useWorkoutsStore.getState().filters.from).toBeNull()
  })

  it('resetFilters clears all filters', () => {
    useWorkoutsStore.getState().setFilter('workout_type', 'lifting')
    useWorkoutsStore.getState().setFilter('from', '2026-01-01')
    useWorkoutsStore.getState().setFilter('to', '2026-12-31')
    useWorkoutsStore.getState().resetFilters()
    expect(useWorkoutsStore.getState().filters).toEqual({
      workout_type: null,
      from: null,
      to: null,
    })
  })

  it('setFilter does not affect other state fields', () => {
    useWorkoutsStore.getState().selectWorkout('workout-42')
    useWorkoutsStore.getState().setFilter('to', '2026-06-01')
    expect(useWorkoutsStore.getState().selectedWorkoutId).toBe('workout-42')
  })
})
