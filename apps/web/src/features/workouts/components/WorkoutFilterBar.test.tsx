import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkoutsStore } from '../store/workouts.store'
import { WorkoutFilterBar } from './WorkoutFilterBar'

beforeEach(() => {
  useWorkoutsStore.setState({
    selectedWorkoutId: null,
    activeTab: 'list',
    filters: { workout_type: null, from: null, to: null },
  })
})

describe('WorkoutFilterBar', () => {
  it('renders type select, from/to date inputs, and reset button', () => {
    render(<WorkoutFilterBar />)
    expect(screen.getByRole('combobox', { name: /filter by workout type/i })).toBeTruthy()
    expect(screen.getByLabelText(/from date/i)).toBeTruthy()
    expect(screen.getByLabelText(/to date/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /reset/i })).toBeTruthy()
  })

  it('calls setFilter when workout type changes', async () => {
    const user = userEvent.setup()
    render(<WorkoutFilterBar />)
    const select = screen.getByRole('combobox', { name: /filter by workout type/i })
    await user.selectOptions(select, 'amrap')
    expect(useWorkoutsStore.getState().filters.workout_type).toBe('amrap')
  })

  it('calls setFilter when from date changes', async () => {
    const user = userEvent.setup()
    render(<WorkoutFilterBar />)
    const fromInput = screen.getByLabelText(/from date/i)
    await user.type(fromInput, '2026-01-01')
    expect(useWorkoutsStore.getState().filters.from).toBe('2026-01-01')
  })

  it('calls resetFilters when reset button is clicked', async () => {
    const user = userEvent.setup()
    useWorkoutsStore.getState().setFilter('workout_type', 'lifting')
    render(<WorkoutFilterBar />)
    await user.click(screen.getByRole('button', { name: /reset/i }))
    expect(useWorkoutsStore.getState().filters).toEqual({
      workout_type: null,
      from: null,
      to: null,
    })
  })
})
