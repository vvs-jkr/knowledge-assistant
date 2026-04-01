import { fireEvent, render, screen } from '@testing-library/react'
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
  it('renders type select and from/to date inputs', () => {
    render(<WorkoutFilterBar />)
    expect(screen.getByRole('combobox', { name: /фильтр по типу тренировки/i })).toBeTruthy()
    expect(screen.getByLabelText(/дата от/i)).toBeTruthy()
    expect(screen.getByLabelText(/дата до/i)).toBeTruthy()
  })

  it('does not show clear button when no filters active', () => {
    render(<WorkoutFilterBar />)
    expect(screen.queryByRole('button', { name: /сброс/i })).toBeNull()
  })

  it('calls setFilter when workout type changes', async () => {
    const user = userEvent.setup()
    render(<WorkoutFilterBar />)
    const select = screen.getByRole('combobox', { name: /фильтр по типу тренировки/i })
    await user.selectOptions(select, 'amrap')
    expect(useWorkoutsStore.getState().filters.workout_type).toBe('amrap')
  })

  it('calls setFilter when from date changes', async () => {
    render(<WorkoutFilterBar />)
    const fromInput = screen.getByLabelText(/дата от/i)
    fireEvent.change(fromInput, { target: { value: '2026-01-01' } })
    expect(useWorkoutsStore.getState().filters.from).toBe('2026-01-01')
  })

  it('calls resetFilters when clear button is clicked', async () => {
    const user = userEvent.setup()
    useWorkoutsStore.getState().setFilter('workout_type', 'lifting')
    render(<WorkoutFilterBar />)
    await user.click(screen.getByRole('button', { name: /сброс/i }))
    expect(useWorkoutsStore.getState().filters).toEqual({
      workout_type: null,
      from: null,
      to: null,
    })
  })
})
