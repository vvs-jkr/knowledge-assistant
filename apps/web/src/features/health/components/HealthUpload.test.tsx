import { useHealthStore } from '@/features/health/store/health.store'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HealthUpload } from './HealthUpload'

vi.mock('@/features/health/api/health.api', () => ({
  useUploadHealth: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

describe('HealthUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useHealthStore.setState({
      activeSection: 'inbody',
      selectedRecordId: null,
      selectedLabBatchId: null,
      selectedMetric: null,
      dateRange: null,
    })
  })

  it('renders the upload prompt text', () => {
    render(<HealthUpload />)
    expect(screen.getByText('Перетащите CSV из InBody')).toBeDefined()
  })

  it('renders a hidden file input', () => {
    render(<HealthUpload />)
    const input = document.querySelector('input[type="file"]')
    expect(input).not.toBeNull()
  })

  it('file input restricts to CSV mime type in InBody mode', () => {
    render(<HealthUpload />)
    const input = document.querySelector('input[type="file"]')
    const accept = input?.getAttribute('accept') ?? ''
    expect(accept).toContain('.csv')
  })

  it('renders lab date input in labs mode', () => {
    useHealthStore.getState().setActiveSection('labs')
    render(<HealthUpload />)
    expect(screen.getByLabelText('Дата сдачи')).toBeDefined()
  })

  it('renders lab name input in labs mode', () => {
    useHealthStore.getState().setActiveSection('labs')
    render(<HealthUpload />)
    expect(screen.getByLabelText('Лаборатория')).toBeDefined()
  })

  it('upload button is disabled when no file selected', () => {
    render(<HealthUpload />)
    const btn = screen.getByRole('button', { name: /Загрузить InBody CSV/i })
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('shows "Загрузка..." when mutation is pending', async () => {
    const { useUploadHealth } = await import('@/features/health/api/health.api')
    vi.mocked(useUploadHealth).mockReturnValueOnce({
      mutate: vi.fn(),
      isPending: true,
    } as unknown as ReturnType<typeof useUploadHealth>)
    render(<HealthUpload />)
    expect(screen.getByText('Загрузка...')).toBeDefined()
  })
})
