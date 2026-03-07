import { useHealthStore } from '@/features/health/store/health.store'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HealthRecordList } from './HealthRecordList'

vi.mock('@/features/health/api/health.api', () => ({
  useHealthRecords: vi.fn(() => ({ data: undefined, isLoading: false })),
  useDeleteHealthRecord: vi.fn(() => ({ mutate: vi.fn() })),
}))

const resetStore = () =>
  useHealthStore.setState({ selectedRecordId: null, selectedMetric: null, dateRange: null })

const mockRecord = {
  id: 'rec-1',
  filename: 'lab.pdf',
  lab_date: '2026-01-15',
  lab_name: 'City Lab',
  pdf_size_bytes: 204800,
  metrics_count: 3,
  created_at: '2026-01-15T12:00:00Z',
}

describe('HealthRecordList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  it('shows empty state when no records exist', () => {
    render(<HealthRecordList />)
    expect(screen.getByText('No records yet')).toBeDefined()
  })

  it('shows skeleton rows while loading', async () => {
    const { useHealthRecords } = await import('@/features/health/api/health.api')
    vi.mocked(useHealthRecords).mockReturnValueOnce({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useHealthRecords>)
    const { container } = render(<HealthRecordList />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders record lab_date when records are present', async () => {
    const { useHealthRecords } = await import('@/features/health/api/health.api')
    vi.mocked(useHealthRecords).mockReturnValueOnce({
      data: [mockRecord],
      isLoading: false,
    } as ReturnType<typeof useHealthRecords>)
    render(<HealthRecordList />)
    expect(screen.getByText('2026-01-15')).toBeDefined()
  })

  it('selects a record on click', async () => {
    const { useHealthRecords } = await import('@/features/health/api/health.api')
    vi.mocked(useHealthRecords).mockReturnValue({
      data: [mockRecord],
      isLoading: false,
    } as ReturnType<typeof useHealthRecords>)
    const user = userEvent.setup()
    render(<HealthRecordList />)
    await user.click(screen.getByText('2026-01-15'))
    expect(useHealthStore.getState().selectedRecordId).toBe('rec-1')
  })

  it('renders multiple records', async () => {
    const { useHealthRecords } = await import('@/features/health/api/health.api')
    vi.mocked(useHealthRecords).mockReturnValueOnce({
      data: [mockRecord, { ...mockRecord, id: 'rec-2', lab_date: '2026-02-10' }],
      isLoading: false,
    } as ReturnType<typeof useHealthRecords>)
    render(<HealthRecordList />)
    expect(screen.getByText('2026-01-15')).toBeDefined()
    expect(screen.getByText('2026-02-10')).toBeDefined()
  })
})
