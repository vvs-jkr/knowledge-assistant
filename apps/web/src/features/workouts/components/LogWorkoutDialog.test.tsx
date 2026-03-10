import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { useCreateWorkoutLog } from '../api/workouts.api'
import { LogWorkoutDialog } from './LogWorkoutDialog'

vi.mock('../api/workouts.api', () => ({
  useCreateWorkoutLog: vi.fn(),
}))

const mockMutate = vi.fn()
const mockReset = vi.fn()

function makeMutationMock(overrides: Record<string, unknown> = {}) {
  return {
    mutate: mockMutate,
    reset: mockReset,
    isPending: false,
    isError: false,
    isSuccess: false,
    data: undefined,
    ...overrides,
  } as unknown as ReturnType<typeof useCreateWorkoutLog>
}

beforeEach(async () => {
  vi.clearAllMocks()
  const { useCreateWorkoutLog: mock } = await import('../api/workouts.api')
  vi.mocked(mock).mockReturnValue(makeMutationMock())
})

describe('LogWorkoutDialog', () => {
  it('dialog is closed by default', () => {
    render(<LogWorkoutDialog workoutId="w-1" workoutName="Morning WOD" />)
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('clicking trigger opens the dialog', async () => {
    const user = userEvent.setup()
    render(<LogWorkoutDialog workoutId="w-1" workoutName="Morning WOD" />)
    await user.click(screen.getByRole('button', { name: /log result/i }))
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    expect(document.body.querySelector('h2')?.textContent).toMatch(/log workout result/i)
  })

  it('submitting the form calls mutate', async () => {
    const user = userEvent.setup()
    render(<LogWorkoutDialog workoutId="w-1" workoutName="Morning WOD" />)
    await user.click(screen.getByRole('button', { name: /log result/i }))
    const saveBtn = document.body.querySelector('button[type="submit"]')
    if (saveBtn) await user.click(saveBtn as HTMLElement)
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ workout_id: 'w-1' }),
      expect.any(Object)
    )
  })

  it('clicking cancel calls reset', async () => {
    const user = userEvent.setup()
    render(<LogWorkoutDialog workoutId="w-1" workoutName="Morning WOD" />)
    await user.click(screen.getByRole('button', { name: /log result/i }))
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    const buttons = document.body.querySelectorAll('button[type="button"]')
    const cancelButton = Array.from(buttons).find((b) => b.textContent === 'Cancel')
    if (cancelButton) await user.click(cancelButton as HTMLElement)
    expect(mockReset).toHaveBeenCalled()
  })

  it('shows workout name in description', async () => {
    const user = userEvent.setup()
    render(<LogWorkoutDialog workoutId="w-1" workoutName="Fran" />)
    await user.click(screen.getByRole('button', { name: /log result/i }))
    expect(document.body.textContent).toContain('Fran')
  })

  it('shows error message when mutation errors', async () => {
    const { useCreateWorkoutLog: mock } = await import('../api/workouts.api')
    vi.mocked(mock).mockReturnValue(makeMutationMock({ isError: true }))
    const user = userEvent.setup()
    render(<LogWorkoutDialog workoutId="w-1" workoutName="Morning WOD" />)
    await user.click(screen.getByRole('button', { name: /log result/i }))
    expect(document.body.textContent).toContain('Failed to log workout')
  })
})
