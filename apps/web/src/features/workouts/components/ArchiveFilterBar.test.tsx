import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useArchivedWorkouts, useBatchReviewArchivedWorkouts } from '../api/workouts.api'
import { useWorkoutsStore } from '../store/workouts.store'
import { ArchiveFilterBar } from './ArchiveFilterBar'

vi.mock('../api/workouts.api', () => ({
  useArchivedWorkouts: vi.fn(),
  useBatchReviewArchivedWorkouts: vi.fn(),
}))

vi.mock('../store/workouts.store', () => ({
  useWorkoutsStore: vi.fn(),
}))

const mockMutateAsync = vi.fn()
const mockClearSelection = vi.fn()

const archiveItems = [
  {
    id: 'archive-1',
    archive_date: '2024-11-21',
    title: 'Death By Pull-up',
    source_system: 'btwb',
    source_type: 'digitized',
    review_status: 'needs_review' as const,
    ready_for_retrieval: false,
    quality_score: 0.7,
    section_count: 2,
    image_count: 1,
    created_at: '2026-04-02T10:00:00Z',
    updated_at: '2026-04-02T10:00:00Z',
  },
]

function setupStore(selectedIds: string[] = []) {
  const mockUseWorkoutsStore = vi.mocked(useWorkoutsStore)
  mockUseWorkoutsStore.mockImplementation((selector) => {
    const state = {
      selectedWorkoutId: null,
      selectedArchiveWorkoutId: null,
      selectedArchiveWorkoutIds: selectedIds,
      activeTab: 'archive' as const,
      selectedPlanId: null,
      filters: { workout_type: null, from: null, to: null },
      archiveFilters: { review_status: null, year: null },
      selectWorkout: vi.fn(),
      selectArchiveWorkout: vi.fn(),
      toggleArchiveWorkoutSelection: vi.fn(),
      clearArchiveWorkoutSelection: mockClearSelection,
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

beforeEach(() => {
  vi.clearAllMocks()
  setupStore()
  vi.mocked(useArchivedWorkouts).mockReturnValue({
    data: archiveItems,
    isLoading: false,
  } as never)
  vi.mocked(useBatchReviewArchivedWorkouts).mockReturnValue({
    mutateAsync: mockMutateAsync.mockResolvedValue({ updated: 1 }),
    isPending: false,
  } as never)
  vi.stubGlobal('confirm', vi.fn(() => true))
})

describe('ArchiveFilterBar', () => {
  it('does not auto-select all needs_review cards when nothing is selected', () => {
    render(<ArchiveFilterBar />)
    expect(screen.getByText('Карточек: 1')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /отметить как проверенные/i }).hasAttribute('disabled')
    ).toBe(true)
    expect(
      screen.getByRole('button', { name: /исправлено и в rag/i }).hasAttribute('disabled')
    ).toBe(true)
  })

  it('confirms and runs batch review only for explicitly selected cards', async () => {
    setupStore(['archive-1'])
    const user = userEvent.setup()
    render(<ArchiveFilterBar />)

    await user.click(screen.getByRole('button', { name: /исправлено и в rag/i }))

    expect(globalThis.confirm).toHaveBeenCalled()
    expect(mockMutateAsync).toHaveBeenCalledWith({
      ids: ['archive-1'],
      review_status: 'corrected',
      ready_for_retrieval: true,
    }, expect.any(Object))
  })
})
