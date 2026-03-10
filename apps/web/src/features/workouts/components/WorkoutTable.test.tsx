import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { useWorkouts } from '../api/workouts.api'
import { useWorkoutsStore } from '../store/workouts.store'
import { WorkoutTable } from './WorkoutTable'

vi.mock('../api/workouts.api', () => ({
  useWorkouts: vi.fn(),
}))

vi.mock('../store/workouts.store', () => ({
  useWorkoutsStore: vi.fn(),
}))

const mockSelectWorkout = vi.fn()
const mockFilters = { workout_type: null, from: null, to: null }

function setupStore() {
  const mockUseWorkoutsStore = vi.mocked(useWorkoutsStore)
  mockUseWorkoutsStore.mockImplementation((selector) => {
    const state = {
      selectedWorkoutId: null,
      activeTab: 'list' as const,
      filters: mockFilters,
      selectWorkout: mockSelectWorkout,
      setActiveTab: vi.fn(),
      setFilter: vi.fn(),
      resetFilters: vi.fn(),
    }
    return selector(state)
  })
}

const baseWorkout = {
  id: 'workout-1',
  date: '2026-01-15',
  name: 'Morning WOD',
  workout_type: 'for_time' as const,
  duration_mins: 30,
  rounds: null,
  exercise_count: 5,
  source_type: 'manual' as const,
  created_at: '2026-01-15T08:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSelectWorkout.mockReset()
  setupStore()
})

describe('WorkoutTable', () => {
  it('shows skeleton while loading', async () => {
    const { useWorkouts: mockUseWorkouts } = await import('../api/workouts.api')
    vi.mocked(mockUseWorkouts).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useWorkouts>)
    render(<WorkoutTable />)
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('shows empty state when no workouts', async () => {
    const { useWorkouts: mockUseWorkouts } = await import('../api/workouts.api')
    vi.mocked(mockUseWorkouts).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkouts>)
    render(<WorkoutTable />)
    expect(screen.getByText(/no workouts found/i)).toBeTruthy()
  })

  it('renders workout name and date', async () => {
    const { useWorkouts: mockUseWorkouts } = await import('../api/workouts.api')
    vi.mocked(mockUseWorkouts).mockReturnValue({
      data: [baseWorkout],
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkouts>)
    render(<WorkoutTable />)
    expect(screen.getByText('Morning WOD')).toBeTruthy()
    expect(screen.getByText('2026-01-15')).toBeTruthy()
  })

  it('renders em dash for null duration', async () => {
    const { useWorkouts: mockUseWorkouts } = await import('../api/workouts.api')
    vi.mocked(mockUseWorkouts).mockReturnValue({
      data: [{ ...baseWorkout, duration_mins: null, rounds: null }],
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkouts>)
    render(<WorkoutTable />)
    // Both duration_mins and rounds are null, so two '—' cells appear
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  it('clicking a row calls selectWorkout with row id', async () => {
    const user = userEvent.setup()
    const { useWorkouts: mockUseWorkouts } = await import('../api/workouts.api')
    vi.mocked(mockUseWorkouts).mockReturnValue({
      data: [baseWorkout],
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkouts>)
    render(<WorkoutTable />)
    const row = screen.getByText('Morning WOD').closest('tr')
    if (row) await user.click(row)
    expect(mockSelectWorkout).toHaveBeenCalledWith('workout-1')
  })

  it('renders workout_type badge', async () => {
    const { useWorkouts: mockUseWorkouts } = await import('../api/workouts.api')
    vi.mocked(mockUseWorkouts).mockReturnValue({
      data: [baseWorkout],
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkouts>)
    render(<WorkoutTable />)
    expect(screen.getByText('for_time')).toBeTruthy()
  })

  it('renders duration when not null', async () => {
    const { useWorkouts: mockUseWorkouts } = await import('../api/workouts.api')
    vi.mocked(mockUseWorkouts).mockReturnValue({
      data: [{ ...baseWorkout, rounds: null, duration_mins: 20 }],
      isLoading: false,
    } as unknown as ReturnType<typeof useWorkouts>)
    render(<WorkoutTable />)
    expect(screen.getByText('20 min')).toBeTruthy()
  })
})
