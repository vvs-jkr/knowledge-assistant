import { describe, expect, it } from 'vitest'
import {
  workoutDetailSchema,
  workoutExerciseSchema,
  workoutLogSchema,
  workoutStatsSchema,
  workoutSummarySchema,
} from './workouts.schema'

const baseSummary = {
  id: 'workout-1',
  date: '2026-01-15',
  name: 'Morning WOD',
  workout_type: 'for_time' as const,
  duration_mins: 30,
  rounds: null,
  exercise_count: 5,
  source_type: 'manual' as const,
  created_at: '2026-01-15T08:00:00Z',
}

const baseExercise = {
  id: 'ex-1',
  exercise_id: 'exc-1',
  exercise_name: 'Pull-up',
  muscle_groups: ['back', 'biceps'],
  reps: 10,
  sets: 3,
  weight_kg: null,
  weight_note: null,
  duration_secs: null,
  order_index: 0,
  notes: null,
}

const baseDetail = {
  ...baseSummary,
  exercises: [baseExercise],
  raw_text: null,
  source_file: null,
  year_confidence: null,
  updated_at: '2026-01-15T08:00:00Z',
}

const baseLog = {
  id: 'log-1',
  workout_id: 'workout-1',
  workout_name: 'Morning WOD',
  completed_at: '2026-01-15T09:00:00Z',
  duration_secs: 1800,
  rounds_completed: null,
  notes: null,
  created_at: '2026-01-15T09:01:00Z',
}

const baseStats = {
  heatmap: [{ date: '2026-01-15', count: 2 }],
  weekly_volume: [{ week_start: '2026-01-13', total_volume: 5000, workout_count: 3 }],
  type_distribution: [{ workout_type: 'for_time', count: 5 }],
  exercise_progress: [{ date: '2026-01-15', max_weight_kg: 80, total_sets: 3, total_reps: 30 }],
  total_workouts: 42,
  total_logs: 100,
  current_streak_days: 7,
}

describe('workoutSummarySchema', () => {
  it('accepts valid summary', () => {
    expect(workoutSummarySchema.safeParse(baseSummary).success).toBe(true)
  })

  it('accepts null duration_mins and rounds', () => {
    const data = { ...baseSummary, duration_mins: null, rounds: null }
    expect(workoutSummarySchema.safeParse(data).success).toBe(true)
  })

  it('accepts all valid workout types', () => {
    for (const wt of [
      'for_time',
      'amrap',
      'emom',
      'tabata',
      'lifting',
      'rounds',
      'other',
    ] as const) {
      expect(workoutSummarySchema.safeParse({ ...baseSummary, workout_type: wt }).success).toBe(
        true
      )
    }
  })

  it('rejects invalid workout_type', () => {
    expect(workoutSummarySchema.safeParse({ ...baseSummary, workout_type: 'yoga' }).success).toBe(
      false
    )
  })

  it('rejects invalid source_type', () => {
    expect(workoutSummarySchema.safeParse({ ...baseSummary, source_type: 'unknown' }).success).toBe(
      false
    )
  })

  it('rejects missing required fields', () => {
    const { id: _id, ...without } = baseSummary
    expect(workoutSummarySchema.safeParse(without).success).toBe(false)
  })
})

describe('workoutExerciseSchema', () => {
  it('accepts valid exercise', () => {
    expect(workoutExerciseSchema.safeParse(baseExercise).success).toBe(true)
  })

  it('accepts all nullable fields as null', () => {
    const data = {
      ...baseExercise,
      reps: null,
      sets: null,
      weight_kg: null,
      weight_note: null,
      duration_secs: null,
      notes: null,
    }
    expect(workoutExerciseSchema.safeParse(data).success).toBe(true)
  })

  it('rejects missing exercise_name', () => {
    const { exercise_name: _en, ...without } = baseExercise
    expect(workoutExerciseSchema.safeParse(without).success).toBe(false)
  })
})

describe('workoutDetailSchema', () => {
  it('accepts valid detail', () => {
    expect(workoutDetailSchema.safeParse(baseDetail).success).toBe(true)
  })

  it('accepts empty exercises array', () => {
    const data = { ...baseDetail, exercises: [] }
    expect(workoutDetailSchema.safeParse(data).success).toBe(true)
  })

  it('accepts nullable raw_text and source_file', () => {
    const data = { ...baseDetail, raw_text: null, source_file: null }
    expect(workoutDetailSchema.safeParse(data).success).toBe(true)
  })

  it('rejects missing updated_at', () => {
    const { updated_at: _ua, ...without } = baseDetail
    expect(workoutDetailSchema.safeParse(without).success).toBe(false)
  })
})

describe('workoutLogSchema', () => {
  it('accepts valid log', () => {
    expect(workoutLogSchema.safeParse(baseLog).success).toBe(true)
  })

  it('accepts all nullable fields as null', () => {
    const data = { ...baseLog, duration_secs: null, rounds_completed: null, notes: null }
    expect(workoutLogSchema.safeParse(data).success).toBe(true)
  })

  it('rejects missing workout_id', () => {
    const { workout_id: _wid, ...without } = baseLog
    expect(workoutLogSchema.safeParse(without).success).toBe(false)
  })
})

describe('workoutStatsSchema', () => {
  it('accepts valid stats', () => {
    expect(workoutStatsSchema.safeParse(baseStats).success).toBe(true)
  })

  it('accepts empty arrays', () => {
    const data = {
      ...baseStats,
      heatmap: [],
      weekly_volume: [],
      type_distribution: [],
      exercise_progress: [],
    }
    expect(workoutStatsSchema.safeParse(data).success).toBe(true)
  })

  it('rejects invalid type_distribution workout_type', () => {
    const data = {
      ...baseStats,
      type_distribution: [{ workout_type: 'yoga', count: 1 }],
    }
    expect(workoutStatsSchema.safeParse(data).success).toBe(false)
  })

  it('rejects missing total_workouts', () => {
    const { total_workouts: _tw, ...without } = baseStats
    expect(workoutStatsSchema.safeParse(without).success).toBe(false)
  })
})
