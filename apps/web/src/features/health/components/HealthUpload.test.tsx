import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HealthUpload } from './HealthUpload'

vi.mock('@/features/health/api/health.api', () => ({
  useUploadHealth: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

describe('HealthUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the upload prompt text', () => {
    render(<HealthUpload />)
    expect(screen.getByText('Перетащите PDF или CSV из InBody')).toBeDefined()
  })

  it('renders a hidden file input', () => {
    render(<HealthUpload />)
    const input = document.querySelector('input[type="file"]')
    expect(input).not.toBeNull()
  })

  it('file input restricts to PDF mime type', () => {
    render(<HealthUpload />)
    const input = document.querySelector('input[type="file"]')
    const accept = input?.getAttribute('accept') ?? ''
    expect(accept).toContain('.pdf')
  })

  it('renders lab date input', () => {
    render(<HealthUpload />)
    expect(screen.getByLabelText('Дата анализа')).toBeDefined()
  })

  it('renders lab name input', () => {
    render(<HealthUpload />)
    expect(screen.getByLabelText('Название лаборатории')).toBeDefined()
  })

  it('upload button is disabled when no file selected', () => {
    render(<HealthUpload />)
    const btn = screen.getByRole('button', { name: /Загрузить и распознать/i })
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
