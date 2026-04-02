import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { useArchivedWorkouts } from '../api/workouts.api'
import { useWorkoutsStore } from '../store/workouts.store'
import { ArchiveTable } from './ArchiveTable'

vi.mock('../api/workouts.api', () => ({
  useArchivedWorkouts: vi.fn(),
}))

vi.mock('../store/workouts.store', () => ({
  useWorkoutsStore: vi.fn(),
}))

const mockSelectArchiveWorkout = vi.fn()
const mockArchiveFilters = { review_status: null, year: null }

function setupStore() {
  const mockUseWorkoutsStore = vi.mocked(useWorkoutsStore)
  mockUseWorkoutsStore.mockImplementation((selector) => {
    const state = {
      selectedWorkoutId: null,
      selectedArchiveWorkoutId: null,
      selectedArchiveWorkoutIds: [],
      activeTab: 'archive' as const,
      selectedPlanId: null,
      filters: { workout_type: null, from: null, to: null },
      archiveFilters: mockArchiveFilters,
      selectWorkout: vi.fn(),
      selectArchiveWorkout: mockSelectArchiveWorkout,
      toggleArchiveWorkoutSelection: vi.fn(),
      clearArchiveWorkoutSelection: vi.fn(),
      setActiveTab: vi.fn(),
      selectPlan: vi.fn(),
      setFilter: vi.fn(),
      setArchiveFilter: vi.fn(),
      resetFilters: vi.fn(),
      resetArchiveFilters: vi.fn(),
    }
    return selector(state)
  })
}

const baseArchiveWorkout = {
  id: 'archive-1',
  archive_date: '2022-06-03',
  title: 'BTWB Card',
  source_system: 'btwb',
  source_type: 'digitized',
  review_status: 'needs_review' as const,
  ready_for_retrieval: false,
  quality_score: 0.4,
  section_count: 2,
  image_count: 1,
  created_at: '2026-04-02T10:00:00Z',
  updated_at: '2026-04-02T10:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSelectArchiveWorkout.mockReset()
  setupStore()
})

describe('ArchiveTable', () => {
  it('shows empty state when no archive cards', async () => {
    const { useArchivedWorkouts: mockUseArchivedWorkouts } = await import('../api/workouts.api')
    vi.mocked(mockUseArchivedWorkouts).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useArchivedWorkouts>)
    render(<ArchiveTable />)
    expect(screen.getByText(/архивные карточки не найдены/i)).toBeTruthy()
  })

  it('renders archive card title and status', async () => {
    const { useArchivedWorkouts: mockUseArchivedWorkouts } = await import('../api/workouts.api')
    vi.mocked(mockUseArchivedWorkouts).mockReturnValue({
      data: [baseArchiveWorkout],
      isLoading: false,
    } as unknown as ReturnType<typeof useArchivedWorkouts>)
    render(<ArchiveTable />)
    expect(screen.getByText('BTWB Card')).toBeTruthy()
    expect(screen.getByText('Нужно проверить')).toBeTruthy()
  })

  it('clicking a row selects archive workout', async () => {
    const user = userEvent.setup()
    const { useArchivedWorkouts: mockUseArchivedWorkouts } = await import('../api/workouts.api')
    vi.mocked(mockUseArchivedWorkouts).mockReturnValue({
      data: [baseArchiveWorkout],
      isLoading: false,
    } as unknown as ReturnType<typeof useArchivedWorkouts>)
    render(<ArchiveTable />)
    const row = screen.getByText('BTWB Card').closest('tr')
    if (row) await user.click(row)
    expect(mockSelectArchiveWorkout).toHaveBeenCalledWith('archive-1')
  })
})
