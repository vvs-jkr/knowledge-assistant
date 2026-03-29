import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MetricsTable } from './MetricsTable'

vi.mock('@/features/health/api/health.api', () => ({
  useHealthMetrics: vi.fn(() => ({ data: undefined, isLoading: false })),
}))

const mockMetric = {
  id: 'metric-1',
  record_id: 'rec-1',
  metric_name: 'glucose',
  recorded_date: '2026-01-15',
  value: 5.1,
  unit: 'mmol/L',
  reference_min: 3.9,
  reference_max: 6.1,
  status: 'normal' as const,
}

describe('MetricsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state when no metrics', () => {
    render(<MetricsTable />)
    expect(screen.getByText('Нет данных')).toBeDefined()
  })

  it('shows skeleton while loading', async () => {
    const { useHealthMetrics } = await import('@/features/health/api/health.api')
    vi.mocked(useHealthMetrics).mockReturnValueOnce({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useHealthMetrics>)
    const { container } = render(<MetricsTable />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders metric data in table', async () => {
    const { useHealthMetrics } = await import('@/features/health/api/health.api')
    vi.mocked(useHealthMetrics).mockReturnValueOnce({
      data: [mockMetric],
      isLoading: false,
    } as ReturnType<typeof useHealthMetrics>)
    render(<MetricsTable />)
    expect(screen.getByText('glucose')).toBeDefined()
    expect(screen.getByText('5.1')).toBeDefined()
    expect(screen.getByText('mmol/L')).toBeDefined()
    expect(screen.getAllByText('Норма').length).toBeGreaterThan(0)
  })

  it('renders reference range when both min and max present', async () => {
    const { useHealthMetrics } = await import('@/features/health/api/health.api')
    vi.mocked(useHealthMetrics).mockReturnValueOnce({
      data: [mockMetric],
      isLoading: false,
    } as ReturnType<typeof useHealthMetrics>)
    render(<MetricsTable />)
    expect(screen.getByText('3.9 - 6.1')).toBeDefined()
  })

  it('renders -- when reference range is null', async () => {
    const { useHealthMetrics } = await import('@/features/health/api/health.api')
    vi.mocked(useHealthMetrics).mockReturnValueOnce({
      data: [{ ...mockMetric, reference_min: null, reference_max: null }],
      isLoading: false,
    } as ReturnType<typeof useHealthMetrics>)
    render(<MetricsTable />)
    expect(screen.getByText('--')).toBeDefined()
  })
})
