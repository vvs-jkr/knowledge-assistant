import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WorkoutCard } from './WorkoutCard'

const workout = {
  id: 'w-1',
  date: '2026-04-03',
  name: 'Morning Session',
  workout_type: 'amrap' as const,
  duration_mins: 20,
  rounds: 5,
  exercise_count: 4,
  source_type: 'manual' as const,
  plan_id: null,
  created_at: '2026-04-03T10:00:00Z',
}

describe('WorkoutCard', () => {
  it('uses highlighted completed styling when workout is marked done', () => {
    render(<WorkoutCard workout={workout} onClick={() => {}} isCompleted />)

    const card = screen.getByRole('button')
    expect(card.className.includes('bg-emerald-100/95')).toBe(true)
    expect(card.className.includes('ring-emerald-300/80')).toBe(true)
  })
})
