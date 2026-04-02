import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateWorkoutDialog } from './CreateWorkoutDialog'

const mutateMock = vi.fn()

vi.mock('../api/workouts.api', () => ({
  useCreateWorkout: () => ({
    mutate: mutateMock,
    isPending: false,
  }),
  usePlans: () => ({
    data: [],
  }),
}))

function renderDialog() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <CreateWorkoutDialog />
    </QueryClientProvider>
  )
}

describe('CreateWorkoutDialog', () => {
  beforeEach(() => {
    mutateMock.mockReset()
  })

  it('submits a sectioned workout payload', async () => {
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: /добавить/i }))
    fireEvent.change(screen.getByLabelText(/название/i), {
      target: { value: 'Sectioned Manual Workout' },
    })
    fireEvent.change(screen.getAllByPlaceholderText('Упражнение')[0], {
      target: { value: 'Air Bike' },
    })
    fireEvent.change(screen.getAllByPlaceholderText(/схема \/ prescription/i)[0], {
      target: { value: '5 минут легко' },
    })

    fireEvent.click(screen.getByRole('button', { name: /сохранить тренировку/i }))

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1))
    const payload = mutateMock.mock.calls[0][0]
    expect(payload.name).toBe('Sectioned Manual Workout')
    expect(payload.sections).toBeTruthy()
    expect(payload.sections[0].section_key).toBe('A')
    expect(payload.sections[0].items[0].name).toBe('Air Bike')
  })
})
